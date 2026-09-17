/**
 * API Key Management Service
 *
 * Handles BYOK (Bring Your Own Key) functionality:
 * - Encrypt/decrypt API keys
 * - CRUD operations
 * - Key validation with OpenRouter
 * - Platform usage tracking
 *
 * Created: 2026-01-08
 */

import { CAT_FREE_DAILY_LIMIT } from '@/config/cat-plans';
import type { AnySupabaseClient } from '@/lib/supabase/types';

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';
import { PROVIDER_BASE_URLS } from '@/config/ai-provider-runtime';
import { WIRED_PROVIDER_IDS } from '@/data/aiProviders';
import { PLATFORM_CHAIN_ID } from '@/services/ai/key-chain';
import { apiErrorMessage } from '@/lib/api/errorMessage';

// ==================== TYPES ====================

export interface UserApiKey {
  id: string;
  user_id: string;
  provider: string;
  key_name: string;
  key_hint: string;
  is_valid: boolean;
  is_primary: boolean;
  sort_order: number;
  last_validated_at: string | null;
  last_used_at: string | null;
  total_requests: number;
  total_tokens_used: number;
  created_at: string;
  updated_at: string;
}

export interface PlatformUsage {
  daily_requests: number;
  daily_limit: number;
  requests_remaining: number;
  can_use_platform: boolean;
}

interface KeyValidationResult {
  isValid: boolean;
  error?: string;
  rateLimits?: {
    requestsRemaining: number;
    requestsLimit: number;
  };
}

// ==================== ENCRYPTION ====================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Get encryption key from environment
 * Must be set in all environments - there is no safe fallback for encryption keys
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    // No fallback - encryption keys must be properly configured
    // In development, add API_KEY_ENCRYPTION_SECRET to .env.local
    throw new Error(
      'API_KEY_ENCRYPTION_SECRET environment variable is required. ' +
        'Generate a secure key with: openssl rand -base64 32'
    );
  }
  return scryptSync(secret, 'orangecat-api-keys', 32);
}

/**
 * Encrypt an API key
 */
function encryptApiKey(plainKey: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an API key
 */
function decryptApiKey(encryptedKey: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedKey.split(':');

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted key format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate key hint (last 4 characters)
 */
function generateKeyHint(apiKey: string): string {
  if (apiKey.length < 8) {
    return '****';
  }
  return `...${apiKey.slice(-4)}`;
}

/**
 * Per-provider auth-check endpoint. All return 200 on a valid key, 401/403
 * on an invalid one, and accept `Authorization: Bearer <key>`. Used by
 * `validateKeyWithProvider` to give the user immediate feedback when they
 * paste a key into the BYOK form — much better than the old behaviour
 * (always hit OpenRouter, every other key rejected as "User not found").
 *
 * OpenRouter's `/auth/key` is special because it also returns the user's
 * remaining rate-limit budget, which we forward to the UI.
 */
const PROVIDER_AUTH_ENDPOINTS: Record<string, string> = Object.fromEntries(
  WIRED_PROVIDER_IDS.map(id => [
    id,
    // OpenRouter's /auth/key also returns rate-limit budget; everyone else
    // gets the cheapest authenticated endpoint, /models.
    id === 'openrouter'
      ? `${PROVIDER_BASE_URLS.openrouter}/auth/key`
      : `${PROVIDER_BASE_URLS[id]}/models`,
  ])
);

// ==================== SERVICE CLASS ====================

export class ApiKeyService {
  constructor(private supabase: AnySupabaseClient) {}

  /**
   * Add a new API key for a user
   */
  async addKey(params: {
    userId: string;
    provider: string;
    keyName: string;
    apiKey: string;
    isPrimary?: boolean;
  }): Promise<{ success: boolean; key?: UserApiKey; error?: string }> {
    const { userId, provider, keyName, apiKey, isPrimary = false } = params;

    // Server-side validation hits each provider's own auth/models endpoint
    // (see PROVIDER_AUTH_ENDPOINTS). The user gets immediate, accurate
    // feedback on save — wrong-format keys and wrong-provider keys both get
    // caught here instead of silently saving and failing later in the chat
    // route. Unknown providers (not in the endpoint map) skip the network
    // check and trust the format-level validation done client-side.
    const validation = await this.validateKeyWithProvider(apiKey, provider);
    if (!validation.isValid) {
      return { success: false, error: apiErrorMessage(validation, 'Invalid API key') };
    }

    // Encrypt the key
    const encryptedKey = encryptApiKey(apiKey);
    const keyHint = generateKeyHint(apiKey);

    // Only one primary may exist — multiple is_primary rows break
    // getDecryptedKey's .single() and made "primary" ambiguous in the UI.
    if (isPrimary) {
      await this.supabase
        .from(DATABASE_TABLES.USER_API_KEYS)
        .update({ is_primary: false })
        .eq('user_id', userId)
        .eq('is_primary', true);
    }

    // Store in database
    const { data, error } = await this.supabase
      .from(DATABASE_TABLES.USER_API_KEYS)
      .insert({
        user_id: userId,
        provider,
        key_name: keyName,
        encrypted_key: encryptedKey,
        key_hint: keyHint,
        is_valid: true,
        is_primary: isPrimary,
        last_validated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'A key with this name already exists' };
      }
      return { success: false, error: error.message };
    }

    // Don't return encrypted_key to client
    const safeKey = { ...data, encrypted_key: undefined } as UserApiKey;
    return { success: true, key: safeKey };
  }

  /**
   * Get all API keys for a user (without encrypted values)
   */
  async getKeys(userId: string): Promise<UserApiKey[]> {
    const { data, error } = await this.supabase
      .from(DATABASE_TABLES.USER_API_KEYS)
      .select(
        'id, user_id, provider, key_name, key_hint, is_valid, is_primary, sort_order, last_validated_at, last_used_at, total_requests, total_tokens_used, created_at, updated_at'
      )
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Error fetching API keys', { error, userId }, 'APIKeyService');
      return [];
    }

    return data || [];
  }

  /**
   * Get the decrypted API key for a user (internal use only)
   */
  async getDecryptedKey(userId: string, provider: string = 'openrouter'): Promise<string | null> {
    const { data, error } = await this.supabase
      .from(DATABASE_TABLES.USER_API_KEYS)
      .select('encrypted_key')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('is_valid', true)
      .eq('is_primary', true)
      .single();

    if (error || !data?.encrypted_key) {
      return null;
    }

    try {
      return decryptApiKey(data.encrypted_key);
    } catch {
      logger.error('Failed to decrypt API key', { userId, provider }, 'APIKeyService');
      return null;
    }
  }

  /**
   * All valid keys for a user, decrypted, in fallback order (sort_order asc).
   * Powers the Cat's multi-key fallback chain — the resolver walks these in
   * order, trying the next on rate-limit/error.
   */
  async listDecryptedKeysOrdered(
    userId: string
  ): Promise<Array<{ id: string; provider: string; key: string; sortOrder: number }>> {
    const { data, error } = await this.supabase
      .from(DATABASE_TABLES.USER_API_KEYS)
      .select('id, provider, encrypted_key, sort_order')
      .eq('user_id', userId)
      .eq('is_valid', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error || !data) {
      return [];
    }

    const out: Array<{ id: string; provider: string; key: string; sortOrder: number }> = [];
    for (const row of data as Array<{
      id: string;
      provider: string;
      encrypted_key: string;
      sort_order: number;
    }>) {
      try {
        out.push({
          id: row.id,
          provider: row.provider,
          key: decryptApiKey(row.encrypted_key),
          sortOrder: row.sort_order,
        });
      } catch {
        logger.error(
          'Failed to decrypt key for fallback chain',
          { userId, keyId: row.id },
          'APIKeyService'
        );
      }
    }
    return out;
  }

  /**
   * Reorder a user's keys. `orderedIds` is the desired fallback order (first =
   * tried earliest). Any key not listed keeps its relative position after these.
   */
  async reorderKeys(userId: string, orderedIds: string[]): Promise<boolean> {
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (id === PLATFORM_CHAIN_ID) {
        // The free OrangeCat default — store its position in prefs.
        const { error } = await this.supabase
          .from(DATABASE_TABLES.USER_AI_PREFERENCES)
          .upsert({ user_id: userId, platform_chain_position: i }, { onConflict: 'user_id' });
        if (error) {
          logger.error('Failed to set platform chain position', { userId, error }, 'APIKeyService');
          return false;
        }
        continue;
      }
      const { error } = await this.supabase
        .from(DATABASE_TABLES.USER_API_KEYS)
        .update({ sort_order: i })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) {
        logger.error('Failed to reorder key', { userId, keyId: id, error }, 'APIKeyService');
        return false;
      }
    }
    return true;
  }

  /** The platform default's position in the user's fallback chain (0 = first). */
  async getPlatformChainPosition(userId: string): Promise<number> {
    const { data } = await this.supabase
      .from(DATABASE_TABLES.USER_AI_PREFERENCES)
      .select('platform_chain_position')
      .eq('user_id', userId)
      .maybeSingle();
    return (data?.platform_chain_position as number | undefined) ?? 0;
  }

  /**
   * Set a key as primary
   */
  async setPrimary(userId: string, keyId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from(DATABASE_TABLES.USER_API_KEYS)
      .update({ is_primary: true })
      .eq('id', keyId)
      .eq('user_id', userId);

    return !error;
  }

  /**
   * Delete an API key
   */
  async deleteKey(userId: string, keyId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from(DATABASE_TABLES.USER_API_KEYS)
      .delete()
      .eq('id', keyId)
      .eq('user_id', userId);

    return !error;
  }

  /**
   * Check if user has a valid BYOK
   */
  async hasValidKey(userId: string, provider: string = 'openrouter'): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(DATABASE_TABLES.USER_API_KEYS)
      .select('id')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('is_valid', true)
      .limit(1)
      .single();

    return !error && !!data;
  }

  /**
   * Validate an API key against its provider's own auth/models endpoint.
   *
   * Each provider exposes a cheap GET that returns 200 on a valid key and
   * 401/403 on an invalid one. We use that as a real liveness check — much
   * better than the old behaviour of always validating against OpenRouter
   * (which would reject every non-OpenRouter key as "User not found").
   *
   * For OpenRouter specifically the endpoint returns rate-limit info, which
   * we pass through unchanged so the UI can show how much budget is left.
   * Unknown providers skip validation and trust the format check + chat-route
   * surface for errors.
   */
  async validateKeyWithProvider(
    apiKey: string,
    providerId: string = 'openrouter'
  ): Promise<KeyValidationResult> {
    const cleanKey = apiKey.replace(/[\s\x00-\x1f\x7f]+/g, '');
    const endpoint = PROVIDER_AUTH_ENDPOINTS[providerId];
    if (!endpoint) {
      return { isValid: true };
    }

    try {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401 || response.status === 403) {
        return { isValid: false, error: 'Invalid API key' };
      }
      if (!response.ok) {
        return { isValid: false, error: `Validation failed: ${response.status}` };
      }

      if (providerId === 'openrouter') {
        const data = await response.json();
        return {
          isValid: true,
          rateLimits: {
            requestsRemaining: data.data?.rate_limit?.requests_remaining || 0,
            requestsLimit: data.data?.rate_limit?.requests_limit || 0,
          },
        };
      }

      return { isValid: true };
    } catch {
      return { isValid: false, error: 'Failed to validate key' };
    }
  }

  // ==================== PLATFORM USAGE ====================

  /**
   * Check platform usage limits for a user.
   *
   * Source of truth = the `check_platform_limit` RPC, which since migration
   * 20260610000001_user_plans reads `daily_limit` from `public.user_plans`
   * (free=10, pro=their plan, expired-pro=10). The literal `10` below is the
   * **last-resort safety fallback** for when the RPC or database itself is
   * unreachable — never the source of truth. Keep them in sync with
   * CAT_FREE_DAILY_LIMIT in `src/config/cat-plans.ts` if the free cap moves.
   */
  async checkPlatformUsage(userId: string): Promise<PlatformUsage> {
    const { data, error } = await this.supabase.rpc('check_platform_limit', { p_user_id: userId });

    if (error || !data || data.length === 0) {
      return {
        daily_requests: 0,
        daily_limit: CAT_FREE_DAILY_LIMIT,
        requests_remaining: CAT_FREE_DAILY_LIMIT,
        can_use_platform: true,
      };
    }

    return data[0];
  }

  /**
   * Increment platform usage
   */
  async incrementPlatformUsage(
    userId: string,
    requestCount: number = 1,
    tokenCount: number = 0
  ): Promise<{ limitReached: boolean }> {
    const { data, error } = await this.supabase.rpc('increment_platform_usage', {
      p_user_id: userId,
      p_request_count: requestCount,
      p_token_count: tokenCount,
    });

    if (error) {
      logger.error('Error incrementing platform usage', { error, userId }, 'APIKeyService');
      return { limitReached: false };
    }

    return { limitReached: data?.[0]?.limit_reached || false };
  }
}

// ==================== FACTORY ====================

/**
 * SSOT for "does this user bring their own key?" — the fallback chain walks
 * every VALID key regardless of is_primary, so any valid key means BYOK.
 * (The API route and the settings hook previously computed this differently.)
 */
export function hasActiveByok(keys: Array<Pick<UserApiKey, 'is_valid'>>): boolean {
  return keys.some(k => k.is_valid);
}

export function createApiKeyService(supabase: AnySupabaseClient): ApiKeyService {
  return new ApiKeyService(supabase);
}

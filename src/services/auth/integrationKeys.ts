/**
 * Integration keys — outbound platform API key service.
 *
 * Sibling products (Loki, hirn.li) and third-party integrations
 * authenticate to OrangeCat's platform API with one of these keys. A key
 * is bound to a single actor at mint time; every request the key
 * authenticates acts as that actor.
 *
 * - createIntegrationKey: mints a new key, returns plaintext ONCE.
 * - verifyIntegrationKey: resolves a plaintext key to {userId, actorId}
 *   or returns null. Touches last_used_at on success.
 * - listIntegrationKeys: lists a user's keys (no plaintext, ever).
 * - revokeIntegrationKey: marks a key revoked (audit trail kept).
 *
 * Created: 2026-06-03
 * Last Modified: 2026-06-03
 * Last Modified Summary: Initial implementation — first auth path that doesn't require a Supabase session.
 */

import { fromTable } from '@/lib/supabase/untyped';
import { createHash, randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import {
  resolveCreationActor,
  ActorNotPermittedError,
} from '@/services/actors/resolveCreationActor';

const KEY_LIVE_PREFIX = 'ock_' as const;
const KEY_TEST_PREFIX = 'ock_test_' as const;
const KEY_RANDOM_BYTES = 24; // 48 hex chars → ~192 bits of entropy
const DISPLAY_PREFIX_LENGTH = 11; // "ock_a1b2c3d" / "ock_test_a"
const KEY_PUBLIC_COLUMNS =
  'id, user_id, actor_id, name, key_prefix, scopes, is_test, created_at, last_used_at, expires_at, revoked_at';

export interface IntegrationKey {
  id: string;
  user_id: string;
  actor_id: string;
  name: string;
  key_prefix: string;
  /** Allowed operations. ['*'] = wildcard. Otherwise '<entity>.<read|write>' tokens. */
  scopes: string[];
  /** Sandbox key. Plaintext prefix is `ock_test_` instead of `ock_`. */
  is_test: boolean;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

export interface MintedIntegrationKey {
  /** Stored record (no plaintext). */
  key: IntegrationKey;
  /** Plaintext key — show to user ONCE and never again. */
  plaintext: string;
}

function generatePlaintext(isTest: boolean): string {
  const prefix = isTest ? KEY_TEST_PREFIX : KEY_LIVE_PREFIX;
  return `${prefix}${randomBytes(KEY_RANDOM_BYTES).toString('hex')}`;
}

function hashKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/**
 * Mint a new integration key. The caller (the authenticated user) must be
 * authorised to act as the requested actor — same gate as the actor
 * switcher in entity wizards.
 *
 * @throws ActorNotPermittedError when the user can't act as `actorId`.
 */
export async function createIntegrationKey(params: {
  userId: string;
  actorId: string;
  name: string;
  expiresAt?: Date | null;
  /** Allowed operations. Omit (or pass ['*']) for full authority — current
   *  behaviour. Pass narrower tokens like ['products.write'] for least
   *  privilege. Caller must normalise — we store the array verbatim. */
  scopes?: string[];
  /** Sandbox key. Plaintext gets the `ock_test_` prefix instead of
   *  `ock_`, and entities created via this key are stamped is_test=true
   *  in the entity handlers. Default false (live key). */
  isTest?: boolean;
}): Promise<MintedIntegrationKey> {
  const { userId, actorId, name, expiresAt, scopes, isTest = false } = params;

  // Reuse the actor-resolution gate so mint authority matches create authority.
  await resolveCreationActor(userId, actorId);

  const plaintext = generatePlaintext(isTest);
  const keyHash = hashKey(plaintext);
  const keyPrefix = plaintext.slice(0, DISPLAY_PREFIX_LENGTH);
  const scopesToStore = scopes && scopes.length > 0 ? scopes : ['*'];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from(DATABASE_TABLES.INTEGRATION_KEYS)
    .insert({
      user_id: userId,
      actor_id: actorId,
      name: name.trim(),
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes: scopesToStore,
      is_test: isTest,
      expires_at: expiresAt ? expiresAt.toISOString() : null,
    })
    .select(KEY_PUBLIC_COLUMNS)
    .single();

  if (error || !data) {
    logger.error('createIntegrationKey: insert failed', { error, userId, actorId });
    throw error ?? new Error('Failed to create integration key');
  }

  return { key: data as IntegrationKey, plaintext };
}

/**
 * Resolve a plaintext key to its bound user + actor. Returns null for any
 * malformed / unknown / revoked / expired key — callers should not branch
 * on the failure reason (avoid leaking detail to attackers).
 *
 * Touches last_used_at on success so the UI shows fresh activity.
 */
export async function verifyIntegrationKey(plaintext: string): Promise<{
  userId: string;
  actorId: string;
  keyId: string;
  scopes: string[];
  isTest: boolean;
} | null> {
  // Accept both live and sandbox prefixes; the hash lookup is the real
  // gate. Cheap startsWith short-circuit avoids hashing obviously bad
  // tokens (e.g. a Supabase access token mis-routed here).
  if (
    !plaintext ||
    !(plaintext.startsWith(KEY_LIVE_PREFIX) || plaintext.startsWith(KEY_TEST_PREFIX))
  ) {
    return null;
  }

  const keyHash = hashKey(plaintext);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from(DATABASE_TABLES.INTEGRATION_KEYS)
    .select('id, user_id, actor_id, scopes, is_test, expires_at, revoked_at')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .maybeSingle();

  if (error) {
    logger.error('verifyIntegrationKey: lookup failed', { error });
    return null;
  }

  if (!data) {
    return null;
  }

  const row = data as {
    id: string;
    user_id: string;
    actor_id: string;
    scopes: string[] | null;
    is_test: boolean | null;
    expires_at: string | null;
    revoked_at: string | null;
  };

  if (row.expires_at && new Date(row.expires_at) <= new Date()) {
    return null;
  }

  // Best-effort: don't fail the request if the touch fails.

  fromTable(admin, DATABASE_TABLES.INTEGRATION_KEYS)
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', row.id)
    .then((result: { error: unknown }) => {
      if (result.error) {
        logger.warn('verifyIntegrationKey: failed to touch last_used_at', { error: result.error });
      }
    });

  return {
    userId: row.user_id,
    actorId: row.actor_id,
    keyId: row.id,
    scopes: row.scopes ?? ['*'],
    isTest: row.is_test ?? false,
  };
}

/** List the user's keys — never returns plaintext or the hash. */
export async function listIntegrationKeys(userId: string): Promise<IntegrationKey[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from(DATABASE_TABLES.INTEGRATION_KEYS)
    .select(KEY_PUBLIC_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('listIntegrationKeys: query failed', { error, userId });
    throw error;
  }

  return (data ?? []) as IntegrationKey[];
}

/**
 * Soft-revoke (sets revoked_at). The active-hash index excludes revoked
 * rows, so subsequent verify calls return null immediately.
 *
 * @returns true when the key was found and revoked; false if it didn't
 *          belong to the user (or was already revoked).
 */
export async function revokeIntegrationKey(keyId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient();

  const { data, error } = await fromTable(admin, DATABASE_TABLES.INTEGRATION_KEYS)
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('user_id', userId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    logger.error('revokeIntegrationKey: update failed', { error, userId, keyId });
    throw error;
  }

  return !!data;
}

/**
 * Rotate a key in place: mint a fresh plaintext bound to the same actor
 * and name, then revoke the old key. The two operations are wrapped in a
 * single user-facing action, but on the DB they happen as two writes —
 * no grace period. The customer must atomically swap the env var.
 *
 * Why no grace period in v1: it's simpler, matches the leak-response
 * mental model ("the old key is compromised, kill it now"), and matches
 * the typical env-var swap flow.
 *
 * @throws Error when the old key doesn't belong to the user or is
 *         already revoked — exposed as a generic 404 by the route to
 *         avoid leaking key existence to probers.
 */
export async function rotateIntegrationKey(
  keyId: string,
  userId: string
): Promise<MintedIntegrationKey> {
  const admin = createAdminClient();

  // Lock the source row: must exist, belong to the caller, and still be live.
  const { data: existing, error: fetchError } = await admin
    .from(DATABASE_TABLES.INTEGRATION_KEYS)
    .select('id, actor_id, name, scopes, is_test, expires_at')
    .eq('id', keyId)
    .eq('user_id', userId)
    .is('revoked_at', null)
    .maybeSingle();

  if (fetchError) {
    logger.error('rotateIntegrationKey: fetch failed', { error: fetchError, userId, keyId });
    throw fetchError;
  }
  if (!existing) {
    throw new Error('Key not found');
  }
  const source = existing as {
    id: string;
    actor_id: string;
    name: string;
    scopes: string[] | null;
    is_test: boolean | null;
    expires_at: string | null;
  };

  // Mint the replacement. Re-uses createIntegrationKey's permission gate,
  // so if the user lost the right to act as the actor since mint time,
  // rotation is blocked here. Preserve the source scopes + sandbox flag
  // so rotation is a pure "new secret, same authority" operation.
  const minted = await createIntegrationKey({
    userId,
    actorId: source.actor_id,
    name: source.name,
    expiresAt: source.expires_at ? new Date(source.expires_at) : null,
    scopes: source.scopes ?? undefined,
    isTest: source.is_test ?? false,
  });

  // Revoke the old. Best-effort: if this fails we still return the new
  // plaintext — both keys briefly work, but the user can manually
  // revoke the old one from the UI. The audit trail still shows both.
  const revoked = await revokeIntegrationKey(source.id, userId);
  if (!revoked) {
    logger.warn('rotateIntegrationKey: new key minted but old key revoke returned false', {
      userId,
      newKeyId: minted.key.id,
      oldKeyId: source.id,
    });
  }

  return minted;
}

// Re-export so API handlers can catch the actor-permission error without
// reaching into the actor resolver.
export { ActorNotPermittedError };

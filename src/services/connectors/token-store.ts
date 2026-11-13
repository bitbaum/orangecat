/**
 * Where a connected account's tokens live: cat_connection_tokens, one row
 * per person per provider, encrypted with the webhook-secret cipher
 * (AES-256-GCM, WEBHOOK_SECRET_KEY). The table has no client grants, so
 * every function here takes the service-role client.
 *
 * A provider's own module (services/github/connection.ts,
 * services/google/connection.ts) knows how to get and refresh a token; this
 * one only keeps it.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { decryptWebhookSecret, encryptWebhookSecret } from '@/lib/crypto/webhookSecretCipher';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';

export const CONNECTION_PROVIDERS = ['github', 'google'] as const;
export type ConnectionProvider = (typeof CONNECTION_PROVIDERS)[number];

export interface ConnectionTokens {
  accessToken: string;
  accessExpiresAt: Date | null;
  refreshToken: string | null;
  refreshExpiresAt: Date | null;
}

export interface StoredConnection {
  login: string | null;
  accessToken: string;
  accessExpiresAt: number | null;
  refreshToken: string | null;
}

const seal = (v: string) => encryptWebhookSecret(v).toString('base64');
const open = (v: string) => decryptWebhookSecret(Buffer.from(v, 'base64'));

interface TokenRow {
  account_login: string | null;
  access_token_encrypted: string;
  access_expires_at: string | null;
  refresh_token_encrypted: string | null;
}

export async function saveConnectionTokens(
  admin: AnySupabaseClient,
  userId: string,
  provider: ConnectionProvider,
  login: string | null,
  tokens: ConnectionTokens
): Promise<boolean> {
  const { error } = await admin.from(DATABASE_TABLES.CAT_CONNECTION_TOKENS).upsert({
    user_id: userId,
    provider,
    account_login: login,
    access_token_encrypted: seal(tokens.accessToken),
    access_expires_at: tokens.accessExpiresAt?.toISOString() ?? null,
    refresh_token_encrypted: tokens.refreshToken ? seal(tokens.refreshToken) : null,
    refresh_expires_at: tokens.refreshExpiresAt?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    logger.error('Saving a connection failed', { provider, error: error.message }, 'Connections');
  }
  return !error;
}

export async function deleteConnectionTokens(
  admin: AnySupabaseClient,
  userId: string,
  provider: ConnectionProvider
): Promise<void> {
  await admin
    .from(DATABASE_TABLES.CAT_CONNECTION_TOKENS)
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);
}

/** The stored tokens, opened; null when the person has not connected this provider. */
export async function loadConnectionTokens(
  admin: AnySupabaseClient,
  userId: string,
  provider: ConnectionProvider
): Promise<StoredConnection | null> {
  const { data } = await admin
    .from(DATABASE_TABLES.CAT_CONNECTION_TOKENS)
    .select('account_login, access_token_encrypted, access_expires_at, refresh_token_encrypted')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();
  const row = data as TokenRow | null;
  if (!row) {
    return null;
  }
  return {
    login: row.account_login,
    accessToken: open(row.access_token_encrypted),
    accessExpiresAt: row.access_expires_at ? Date.parse(row.access_expires_at) : null,
    refreshToken: row.refresh_token_encrypted ? open(row.refresh_token_encrypted) : null,
  };
}

/** Connected at all (a row exists): the UI's question, no token work. */
export async function hasConnection(
  admin: AnySupabaseClient,
  userId: string,
  provider: ConnectionProvider
): Promise<{ login: string | null } | null> {
  const { data } = await admin
    .from(DATABASE_TABLES.CAT_CONNECTION_TOKENS)
    .select('account_login')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();
  return data ? { login: (data as { account_login: string | null }).account_login } : null;
}

/** Which providers this person has connected, in one read. */
export async function connectedProviders(
  admin: AnySupabaseClient,
  userId: string
): Promise<Set<ConnectionProvider>> {
  const { data } = await admin
    .from(DATABASE_TABLES.CAT_CONNECTION_TOKENS)
    .select('provider')
    .eq('user_id', userId);
  const out = new Set<ConnectionProvider>();
  for (const row of (data ?? []) as Array<{ provider: string }>) {
    if ((CONNECTION_PROVIDERS as readonly string[]).includes(row.provider)) {
      out.add(row.provider as ConnectionProvider);
    }
  }
  return out;
}

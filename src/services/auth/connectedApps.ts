/**
 * Connected apps — what a person has let in through "Sign in with OrangeCat",
 * and the one way to take it back.
 *
 * Two rows describe a connection: the remembered CONSENT (oauth_user_grants,
 * one per user × client — what the consent screen skips on next time) and the
 * live REFRESH TOKENS (oauth_refresh_tokens — what lets the app keep a session
 * without asking again). Revoking an app removes the consent and revokes every
 * unrevoked refresh token the app holds for this person, so the next time it
 * tries to act it must send them back through the consent screen. Access
 * tokens already issued run out on their own (OAUTH_TTL.accessToken, one hour).
 *
 * Until this existed a self-registered AI app (RFC 7591) could keep a
 * 30-day session the person had no screen to see or end. The oauth_* tables
 * are service-role-only, so every query goes through the admin client and
 * every query names the user — a query that does not is a query across users.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { OAUTH_CLIENT_ORIGINS, type OAuthClientOrigin } from '@/lib/oauth/config';
import { logger } from '@/utils/logger';

function adminDb(): AnySupabaseClient {
  return createAdminClient() as unknown as AnySupabaseClient;
}

export interface ConnectedApp {
  clientId: string;
  name: string;
  /** Whether an OrangeCat operator registered it, or it registered itself. */
  registeredVia: OAuthClientOrigin;
  /** First-party (Loki, Solon…): consent remembered and screen skipped. */
  trusted: boolean;
  scopes: string[];
  grantedAt: string;
  /** Most recent use of any live refresh token, or null if never refreshed. */
  lastUsedAt: string | null;
  /** Unrevoked, unexpired refresh tokens the app currently holds. */
  liveSessions: number;
}

interface GrantRow {
  client_id: string;
  scopes: string[] | null;
  granted_at: string;
}

interface TokenRow {
  client_id: string;
  last_used_at: string | null;
  expires_at: string;
}

interface ClientRow {
  client_id: string;
  name: string;
  registered_via: OAuthClientOrigin | null;
  is_trusted: boolean;
}

/** Every app this person has consented to, newest consent first. */
export async function listConnectedApps(userId: string): Promise<ConnectedApp[]> {
  const db = adminDb();
  const [grants, tokens] = await Promise.all([
    db
      .from(DATABASE_TABLES.OAUTH_USER_GRANTS)
      .select('client_id, scopes, granted_at')
      .eq('user_id', userId)
      .order('granted_at', { ascending: false }),
    db
      .from(DATABASE_TABLES.OAUTH_REFRESH_TOKENS)
      .select('client_id, last_used_at, expires_at')
      .eq('user_id', userId)
      .is('revoked_at', null),
  ]);
  if (grants.error) {
    logger.error('listConnectedApps: grants query failed', { error: grants.error, userId });
    throw grants.error;
  }
  if (tokens.error) {
    logger.error('listConnectedApps: tokens query failed', { error: tokens.error, userId });
    throw tokens.error;
  }

  const grantRows = (grants.data ?? []) as GrantRow[];
  const tokenRows = (tokens.data ?? []) as TokenRow[];
  // A live token with no remembered consent can exist (a consent revoked while
  // a token survived a race, or a first-party grant recorded before consents
  // were stored). It is still a connection the person should see.
  const clientIds = [...new Set([...grantRows, ...tokenRows].map(r => r.client_id))];
  if (clientIds.length === 0) {
    return [];
  }

  const { data: clientData, error: clientError } = await db
    .from(DATABASE_TABLES.OAUTH_CLIENTS)
    .select('client_id, name, registered_via, is_trusted')
    .in('client_id', clientIds);
  if (clientError) {
    logger.error('listConnectedApps: clients query failed', { error: clientError, userId });
    throw clientError;
  }
  const clients = new Map(
    (clientData ?? []).map(c => [(c as ClientRow).client_id, c as ClientRow])
  );

  const now = Date.now();
  const grantByClient = new Map(grantRows.map(g => [g.client_id, g]));
  return clientIds.map(clientId => {
    const client = clients.get(clientId);
    const grant = grantByClient.get(clientId);
    const live = tokenRows.filter(
      t => t.client_id === clientId && new Date(t.expires_at).getTime() > now
    );
    const lastUsed = live
      .map(t => t.last_used_at)
      .filter((v): v is string => !!v)
      .sort()
      .at(-1);
    return {
      clientId,
      name: client?.name ?? clientId,
      registeredVia: client?.registered_via ?? OAUTH_CLIENT_ORIGINS.admin,
      trusted: client?.is_trusted ?? false,
      scopes: grant?.scopes ?? [],
      grantedAt: grant?.granted_at ?? live[0]?.expires_at ?? new Date(0).toISOString(),
      lastUsedAt: lastUsed ?? null,
      liveSessions: live.length,
    };
  });
}

/**
 * Take back an app's access: forget the consent and revoke its refresh tokens.
 * Returns how many refresh tokens were revoked; false if nothing was connected.
 * Idempotent — revoking twice is a no-op, not an error.
 */
export async function revokeConnectedApp(
  userId: string,
  clientId: string
): Promise<{ revoked: boolean; tokensRevoked: number }> {
  const db = adminDb();
  const [grant, tokens] = await Promise.all([
    db
      .from(DATABASE_TABLES.OAUTH_USER_GRANTS)
      .delete()
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .select('client_id'),
    db
      .from(DATABASE_TABLES.OAUTH_REFRESH_TOKENS)
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .is('revoked_at', null)
      .select('id'),
  ]);
  if (grant.error) {
    logger.error('revokeConnectedApp: grant delete failed', { error: grant.error, userId });
    throw grant.error;
  }
  if (tokens.error) {
    logger.error('revokeConnectedApp: token revoke failed', { error: tokens.error, userId });
    throw tokens.error;
  }
  const tokensRevoked = tokens.data?.length ?? 0;
  const revoked = (grant.data?.length ?? 0) > 0 || tokensRevoked > 0;
  if (revoked) {
    logger.info('Connected app revoked', { userId, clientId, tokensRevoked }, 'OAuth');
  }
  return { revoked, tokensRevoked };
}

/**
 * Every app at once — for "Sign out everywhere" and account deletion. Without
 * this, both left the OAuth refresh tokens Solon, Loki and Heidi hold alive:
 * the person signed out of OrangeCat and stayed signed in to everything
 * that signs in through it. Consents are kept on sign-out (a first-party app
 * should not ask again after a lost-device sign-out) and dropped on deletion.
 */
export async function revokeAllConnectedApps(
  userId: string,
  opts: { forgetConsents: boolean }
): Promise<{ tokensRevoked: number }> {
  const db = adminDb();
  const tokens = await db
    .from(DATABASE_TABLES.OAUTH_REFRESH_TOKENS)
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null)
    .select('id');
  if (tokens.error) {
    logger.error('revokeAllConnectedApps: token revoke failed', { error: tokens.error, userId });
    throw tokens.error;
  }
  if (opts.forgetConsents) {
    const grants = await db.from(DATABASE_TABLES.OAUTH_USER_GRANTS).delete().eq('user_id', userId);
    if (grants.error) {
      logger.error('revokeAllConnectedApps: grant delete failed', { error: grants.error, userId });
      throw grants.error;
    }
  }
  return { tokensRevoked: tokens.data?.length ?? 0 };
}

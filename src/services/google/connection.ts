/**
 * Google, connected: mail and calendar, read-only.
 *
 * A standard OAuth web-app authorisation with two scopes and nothing else:
 * gmail.readonly and calendar.readonly. Neither lets a token send a mail,
 * change an event or delete anything. Google's access token lasts an hour;
 * `access_type=offline` with `prompt=consent` makes Google hand a refresh
 * token every time the person connects, so a bot's routine can still read
 * at 08:00 tomorrow.
 *
 * A refresh answers with a new access token and usually NO refresh token:
 * the one we hold stays, which is why refreshing saves it back.
 *
 * Tokens are stored encrypted (services/connectors/token-store.ts). All of
 * this is inert until GOOGLE_CONNECT_CLIENT_ID / _CLIENT_SECRET and
 * WEBHOOK_SECRET_KEY are set.
 */

import { API_ROUTES } from '@/config/api-routes';
import { SITE_URL } from '@/config/brand';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import {
  deleteConnectionTokens,
  loadConnectionTokens,
  saveConnectionTokens,
  type ConnectionTokens,
} from '@/services/connectors/token-store';
import { logger } from '@/utils/logger';

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE = 'https://oauth2.googleapis.com/revoke';
const FETCH_TIMEOUT_MS = 8000;
/** Refresh this long before expiry, so a token never dies mid-turn. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** What a connected Google account may be read for. Read-only, both. */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
] as const;

export function googleConnectionConfigured(env = process.env): boolean {
  return Boolean(
    env.GOOGLE_CONNECT_CLIENT_ID && env.GOOGLE_CONNECT_CLIENT_SECRET && env.WEBHOOK_SECRET_KEY
  );
}

export function googleCallbackUrl(): string {
  return new URL(API_ROUTES.INTEGRATIONS.GOOGLE_CALLBACK, SITE_URL).toString();
}

export function googleAuthorizeUrl(state: string): string {
  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set('client_id', process.env.GOOGLE_CONNECT_CLIENT_ID ?? '');
  url.searchParams.set('redirect_uri', googleCallbackUrl());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  return url.toString();
}

/** Google's token answer, or null when it is a refusal or grants less than both scopes. */
export function parseGoogleTokenResponse(
  json: unknown,
  now: number = Date.now()
): (ConnectionTokens & { scopes: string[] }) | null {
  const t = (json ?? {}) as Record<string, unknown>;
  if (typeof t.access_token !== 'string' || !t.access_token) {
    return null;
  }
  const seconds = typeof t.expires_in === 'number' && t.expires_in > 0 ? t.expires_in : 3600;
  return {
    accessToken: t.access_token,
    accessExpiresAt: new Date(now + seconds * 1000),
    refreshToken: typeof t.refresh_token === 'string' && t.refresh_token ? t.refresh_token : null,
    refreshExpiresAt: null,
    scopes: typeof t.scope === 'string' ? t.scope.split(/\s+/).filter(Boolean) : [],
  };
}

/** The consent screen lets a person untick a scope; say which were left out. */
export function missingGoogleScopes(granted: readonly string[]): string[] {
  return GOOGLE_SCOPES.filter(s => !granted.includes(s));
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CONNECT_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CONNECT_CLIENT_SECRET ?? '',
      ...params,
    }).toString(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const json = await res.json().catch(() => null);
  const tokens = parseGoogleTokenResponse(json);
  if (!tokens) {
    logger.warn(
      'Google token request refused',
      { error: (json as { error?: string } | null)?.error ?? res.status },
      'GoogleConnection'
    );
  }
  return tokens;
}

export function exchangeGoogleCode(code: string) {
  return tokenRequest({
    code,
    grant_type: 'authorization_code',
    redirect_uri: googleCallbackUrl(),
  });
}

export type GoogleAnswer<T> = { ok: true; data: T } | { ok: false; status: number };

/** One read of a Google API as the person. Never throws; 0 = no answer at all. */
export async function googleGet<T>(token: string, url: string): Promise<GoogleAnswer<T>> {
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return res.ok ? { ok: true, data: (await res.json()) as T } : { ok: false, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

export function saveGoogleConnection(
  admin: AnySupabaseClient,
  userId: string,
  email: string | null,
  tokens: ConnectionTokens
): Promise<boolean> {
  return saveConnectionTokens(admin, userId, 'google', email, tokens);
}

/** Forget the tokens, and tell Google to cancel them (best effort). */
export async function deleteGoogleConnection(
  admin: AnySupabaseClient,
  userId: string
): Promise<void> {
  try {
    const row = await loadConnectionTokens(admin, userId, 'google');
    const token = row?.refreshToken ?? row?.accessToken;
    if (token) {
      await fetch(GOOGLE_REVOKE, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }).toString(),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    }
  } catch (error) {
    logger.warn('Google revoke did not go through', { error }, 'GoogleConnection');
  }
  await deleteConnectionTokens(admin, userId, 'google');
}

export interface GoogleConnection {
  email: string | null;
  token: string;
}

/**
 * A usable token for this person, refreshed when close to expiry. null when
 * not connected, not configured, or Google refused the refresh (the person
 * must reconnect; the row is left so the UI can say so).
 */
export async function getGoogleConnection(
  admin: AnySupabaseClient,
  userId: string,
  now: number = Date.now()
): Promise<GoogleConnection | null> {
  if (!googleConnectionConfigured()) {
    return null;
  }
  try {
    const row = await loadConnectionTokens(admin, userId, 'google');
    if (!row) {
      return null;
    }
    if ((row.accessExpiresAt ?? 0) - now > REFRESH_MARGIN_MS) {
      return { email: row.login, token: row.accessToken };
    }
    if (!row.refreshToken) {
      return null;
    }
    const refreshed = await tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: row.refreshToken,
    });
    if (!refreshed) {
      return null;
    }
    await saveGoogleConnection(admin, userId, row.login, {
      ...refreshed,
      refreshToken: refreshed.refreshToken ?? row.refreshToken,
    });
    return { email: row.login, token: refreshed.accessToken };
  } catch (error) {
    logger.warn('Google connection unavailable', { error }, 'GoogleConnection');
    return null;
  }
}

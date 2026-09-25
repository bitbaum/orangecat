/**
 * GitHub, connected for real — a GitHub App's user tokens, read-only.
 *
 * Until this, Cat saw only PUBLIC repos, keyed off the handle a person typed
 * into their profile links. Private work, the issues assigned to them and
 * their releases were invisible, so Cat could not say "your release went out
 * — want to tell your backers?" or "you have 4 issues assigned in X".
 *
 * Why a GitHub App and not an OAuth App: an OAuth App can only reach private
 * repositories through the `repo` scope, which is full READ-WRITE access to
 * code. A GitHub App's user token is limited to the permissions the app
 * declares — here read-only metadata, contents, issues — and it expires in
 * eight hours, with a refresh token, so a leaked token is worth little.
 *
 * A GitHub App's user token only reaches repositories where the app is
 * INSTALLED. Authorising alone would show a person almost nothing private, so
 * connecting goes through the app's install page (with "request user
 * authorization during installation" on): the person picks the repositories
 * Cat may read, and GitHub returns them to our callback with a code, exactly
 * like a plain authorisation.
 *
 * Tokens are stored encrypted (cat_connection_tokens, service role only) with
 * the same AES-256-GCM cipher and key as webhook secrets. Everything here is
 * inert until GITHUB_APP_CLIENT_ID / _CLIENT_SECRET / _SLUG and
 * WEBHOOK_SECRET_KEY are set.
 */

import { API_ROUTES } from '@/config/api-routes';
import { DATABASE_TABLES } from '@/config/database-tables';
import { SITE_URL } from '@/config/brand';
import { decryptWebhookSecret, encryptWebhookSecret } from '@/lib/crypto/webhookSecretCipher';
import { logger } from '@/utils/logger';
import type { AnySupabaseClient } from '@/lib/supabase/types';

const GITHUB_OAUTH = 'https://github.com/login/oauth';
const GITHUB_API = 'https://api.github.com';
const FETCH_TIMEOUT_MS = 5000;
/** Refresh this long before expiry, so a token never dies mid-turn. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export const GITHUB_CALLBACK_PATH = API_ROUTES.INTEGRATIONS.GITHUB_CALLBACK;

export function githubConnectionConfigured(env = process.env): boolean {
  return Boolean(
    env.GITHUB_APP_CLIENT_ID &&
    env.GITHUB_APP_CLIENT_SECRET &&
    env.GITHUB_APP_SLUG &&
    env.WEBHOOK_SECRET_KEY
  );
}

export function githubCallbackUrl(): string {
  return new URL(GITHUB_CALLBACK_PATH, SITE_URL).toString();
}

/**
 * Step 1 — the app's install page, where the person chooses the repositories
 * Cat may read. (Someone who already installed it sees their current
 * selection, so reconnecting works the same way.) GitHub documents no promise
 * that `state` survives this page, so the callback never relies on it: see
 * githubAuthorizeUrl.
 */
export function githubInstallUrl(state: string): string {
  const slug = encodeURIComponent(process.env.GITHUB_APP_SLUG ?? '');
  const url = new URL(`https://github.com/apps/${slug}/installations/new`);
  url.searchParams.set('state', state);
  return url.toString();
}

/**
 * Step 2 — the standard authorisation, which DOES return `state`. The
 * callback sends a return without a trusted state here: the person has
 * already approved the app, so GitHub bounces straight back with a code and
 * our state, and a forged callback link can never plant someone else's code.
 */
export function githubAuthorizeUrl(state: string): string {
  const url = new URL(`${GITHUB_OAUTH}/authorize`);
  url.searchParams.set('client_id', process.env.GITHUB_APP_CLIENT_ID ?? '');
  url.searchParams.set('redirect_uri', githubCallbackUrl());
  url.searchParams.set('state', state);
  return url.toString();
}

export interface GitHubTokenSet {
  accessToken: string;
  accessExpiresAt: Date | null;
  refreshToken: string | null;
  refreshExpiresAt: Date | null;
}

const inSeconds = (s: unknown, now: number): Date | null =>
  typeof s === 'number' && s > 0 ? new Date(now + s * 1000) : null;

/** GitHub answers token errors with 200 + { error }, so parse, don't trust status. */
export function parseTokenResponse(json: unknown, now: number = Date.now()): GitHubTokenSet | null {
  const t = (json ?? {}) as Record<string, unknown>;
  if (typeof t.access_token !== 'string' || !t.access_token) {
    return null;
  }
  return {
    accessToken: t.access_token,
    accessExpiresAt: inSeconds(t.expires_in, now),
    refreshToken: typeof t.refresh_token === 'string' ? t.refresh_token : null,
    refreshExpiresAt: inSeconds(t.refresh_token_expires_in, now),
  };
}

async function tokenRequest(params: Record<string, string>): Promise<GitHubTokenSet | null> {
  const res = await fetch(`${GITHUB_OAUTH}/access_token`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_APP_CLIENT_ID,
      client_secret: process.env.GITHUB_APP_CLIENT_SECRET,
      ...params,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const json = await res.json().catch(() => null);
  const tokens = parseTokenResponse(json);
  if (!tokens) {
    logger.warn(
      'GitHub token request refused',
      { error: (json as { error?: string } | null)?.error ?? res.status },
      'GitHubConnection'
    );
  }
  return tokens;
}

export function exchangeGitHubCode(code: string): Promise<GitHubTokenSet | null> {
  return tokenRequest({ code, redirect_uri: githubCallbackUrl() });
}

export async function githubGet<T>(token: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${GITHUB_API}${path}`, {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

// ─── Storage ─────────────────────────────────────────────────────────────────

const seal = (v: string) => encryptWebhookSecret(v).toString('base64');
const open = (v: string) => decryptWebhookSecret(Buffer.from(v, 'base64'));

interface TokenRow {
  account_login: string | null;
  access_token_encrypted: string;
  access_expires_at: string | null;
  refresh_token_encrypted: string | null;
  refresh_expires_at: string | null;
}

/** `admin` must be the service-role client: the table has no client grants. */
export async function saveGitHubConnection(
  admin: AnySupabaseClient,
  userId: string,
  login: string | null,
  tokens: GitHubTokenSet
): Promise<boolean> {
  const { error } = await admin.from(DATABASE_TABLES.CAT_CONNECTION_TOKENS).upsert({
    user_id: userId,
    provider: 'github',
    account_login: login,
    access_token_encrypted: seal(tokens.accessToken),
    access_expires_at: tokens.accessExpiresAt?.toISOString() ?? null,
    refresh_token_encrypted: tokens.refreshToken ? seal(tokens.refreshToken) : null,
    refresh_expires_at: tokens.refreshExpiresAt?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    logger.error('Saving GitHub connection failed', { error: error.message }, 'GitHubConnection');
  }
  return !error;
}

export async function deleteGitHubConnection(
  admin: AnySupabaseClient,
  userId: string
): Promise<void> {
  await admin
    .from(DATABASE_TABLES.CAT_CONNECTION_TOKENS)
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'github');
}

async function loadRow(admin: AnySupabaseClient, userId: string): Promise<TokenRow | null> {
  const { data } = await admin
    .from(DATABASE_TABLES.CAT_CONNECTION_TOKENS)
    .select(
      'account_login, access_token_encrypted, access_expires_at, refresh_token_encrypted, refresh_expires_at'
    )
    .eq('user_id', userId)
    .eq('provider', 'github')
    .maybeSingle();
  return (data as TokenRow | null) ?? null;
}

export interface GitHubConnection {
  login: string | null;
  token: string;
}

/**
 * A usable token for this person, refreshed when close to expiry. null when
 * not connected, not configured, or the refresh token itself has lapsed (the
 * person must reconnect — the row is left so the UI can say so).
 */
export async function getGitHubConnection(
  admin: AnySupabaseClient,
  userId: string,
  now: number = Date.now()
): Promise<GitHubConnection | null> {
  if (!githubConnectionConfigured()) {
    return null;
  }
  try {
    const row = await loadRow(admin, userId);
    if (!row) {
      return null;
    }
    const expires = row.access_expires_at ? Date.parse(row.access_expires_at) : Infinity;
    if (expires - now > REFRESH_MARGIN_MS) {
      return { login: row.account_login, token: open(row.access_token_encrypted) };
    }
    if (!row.refresh_token_encrypted) {
      return null;
    }
    const refreshed = await tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: open(row.refresh_token_encrypted),
    });
    if (!refreshed) {
      return null;
    }
    await saveGitHubConnection(admin, userId, row.account_login, refreshed);
    return { login: row.account_login, token: refreshed.accessToken };
  } catch (error) {
    logger.warn('GitHub connection unavailable', { error }, 'GitHubConnection');
    return null;
  }
}

/** Connected at all (a row exists) — the UI's question, no token work. */
export async function hasGitHubConnection(
  admin: AnySupabaseClient,
  userId: string
): Promise<{ login: string | null } | null> {
  const { data } = await admin
    .from(DATABASE_TABLES.CAT_CONNECTION_TOKENS)
    .select('account_login')
    .eq('user_id', userId)
    .eq('provider', 'github')
    .maybeSingle();
  return data ? { login: (data as { account_login: string | null }).account_login } : null;
}

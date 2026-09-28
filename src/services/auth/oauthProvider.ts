/**
 * OIDC provider service — authorization-code (+PKCE) and refresh-token flows.
 *
 * Backs the /oauth/authorize and /oauth/token endpoints. All secrets (client
 * secrets, auth codes, refresh tokens) are stored sha256-hashed, mirroring
 * integration_keys. The oauth_* tables are service-role-only (RLS, no policies),
 * so every query here uses the admin client. They aren't in the hand-written
 * `Database` type, so we use the codebase's loose AnySupabaseClient — same as the
 * rest of the dynamic data layer.
 *
 * See src/lib/oauth/config.ts (SSOT) and docs/architecture/PLATFORM_AND_COLLABORATION.md.
 */
import { createHash, randomBytes } from 'node:crypto';
import { DATABASE_TABLES } from '@/config/database-tables';
import { SignJWT } from 'jose';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { getSigningKey } from '@/lib/oauth/keys';
import {
  OAUTH_ISSUER,
  OAUTH_SIGNING_ALG,
  OAUTH_TTL,
  parseAndValidateScopes,
  scopesForResource,
  type OAuthClientOrigin,
  type OAuthResource,
} from '@/lib/oauth/config';
import { logger } from '@/utils/logger';

function adminDb(): AnySupabaseClient {
  return createAdminClient() as unknown as AnySupabaseClient;
}

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');
const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

export interface OAuthClient {
  id: string;
  client_id: string;
  client_secret_hash: string | null;
  name: string;
  redirect_uris: string[];
  allowed_scopes: string[];
  is_confidential: boolean;
  is_trusted: boolean;
  disabled_at: string | null;
  /** 'dcr' when the client registered itself via /oauth/register. */
  registered_via: OAuthClientOrigin;
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const { data } = await adminDb()
    .from(DATABASE_TABLES.OAUTH_CLIENTS)
    .select('*')
    .eq('client_id', clientId)
    .is('disabled_at', null)
    .maybeSingle();
  return (data as OAuthClient | null) ?? null;
}

/** Exact redirect-uri match — no wildcards, ever. */
export function clientAllowsRedirect(client: OAuthClient, uri: string): boolean {
  return client.redirect_uris.includes(uri);
}

export function verifyClientSecret(client: OAuthClient, secret: string | null): boolean {
  if (!client.is_confidential) {
    return true; // public client — authenticated by PKCE instead
  }
  return !!client.client_secret_hash && !!secret && sha256(secret) === client.client_secret_hash;
}

/** Narrow the requested scopes to what the client is allowed to ask for. */
export function effectiveScopes(client: OAuthClient, requested: string[]): string[] {
  return requested.filter(s => client.allowed_scopes.includes(s));
}

/**
 * The scopes a consent may grant: known scopes only, narrowed to the target
 * resource (or defaulted to it when none were asked for — see
 * scopesForResource), then to the client's own ceiling. The authorize page and
 * the approve action both call this, so a replayed form can't widen it.
 */
export function grantableScopes(
  client: OAuthClient,
  rawScope: string | null | undefined,
  resource: OAuthResource | null
): string[] {
  const { granted } = parseAndValidateScopes(rawScope);
  return effectiveScopes(client, scopesForResource(granted, resource));
}

/**
 * RFC 8707 sentinel: the token request named a resource other than the one the
 * grant was bound to. The token endpoint answers `invalid_target`.
 */
export const INVALID_TARGET = 'invalid_target' as const;

/** A token request may repeat the bound resource, or omit it — nothing else. */
function resourceMatches(bound: string | null, requested: string | null | undefined): boolean {
  return !requested || requested === bound;
}

// ── Authorization codes ────────────────────────────────────────────────────

export async function createAuthCode(params: {
  clientId: string;
  actorId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  codeChallengeMethod: string;
  nonce?: string | null;
  /** RFC 8707 resource the eventual access token is bound to (its `aud`). */
  resource?: string | null;
}): Promise<string> {
  const code = randomToken(32);
  const expiresAt = new Date(Date.now() + OAUTH_TTL.authCode * 1000).toISOString();
  const { error } = await adminDb()
    .from(DATABASE_TABLES.OAUTH_AUTH_CODES)
    .insert({
      code_hash: sha256(code),
      client_id: params.clientId,
      actor_id: params.actorId,
      user_id: params.userId,
      redirect_uri: params.redirectUri,
      scopes: params.scopes,
      code_challenge: params.codeChallenge,
      code_challenge_method: params.codeChallengeMethod,
      nonce: params.nonce ?? null,
      resource: params.resource ?? null,
      expires_at: expiresAt,
    });
  if (error) {
    throw new Error(`Failed to create auth code: ${error.message}`);
  }
  return code;
}

export interface ConsumedCode {
  actorId: string;
  userId: string;
  scopes: string[];
  nonce: string | null;
  resource: string | null;
}

/**
 * Validate + single-use-consume an authorization code. Returns null on ANY
 * failure (unknown / replayed / expired / client or redirect mismatch / bad
 * PKCE) — callers must not branch on the reason (avoid an oracle). The one
 * distinguished answer is INVALID_TARGET, returned only AFTER every check above
 * has passed (so it reveals nothing to someone without the code + verifier)
 * and BEFORE the code is burned, so the client can retry without `resource`.
 */
export async function consumeAuthCode(
  code: string,
  opts: { clientId: string; redirectUri: string; codeVerifier: string; resource?: string | null }
): Promise<ConsumedCode | typeof INVALID_TARGET | null> {
  const db = adminDb();
  const { data } = await db
    .from(DATABASE_TABLES.OAUTH_AUTH_CODES)
    .select('*')
    .eq('code_hash', sha256(code))
    .maybeSingle();

  if (!data || data.consumed_at) {
    return null;
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return null;
  }
  if (data.client_id !== opts.clientId || data.redirect_uri !== opts.redirectUri) {
    return null;
  }

  // PKCE verification.
  if (data.code_challenge_method === 'S256') {
    const computed = createHash('sha256').update(opts.codeVerifier).digest('base64url');
    if (computed !== data.code_challenge) {
      return null;
    }
  } else if (opts.codeVerifier !== data.code_challenge) {
    return null;
  }

  if (!resourceMatches(data.resource ?? null, opts.resource)) {
    return INVALID_TARGET;
  }

  // Single-use: conditional update guards against a concurrent second redeem.
  const { data: claimed } = await db
    .from(DATABASE_TABLES.OAUTH_AUTH_CODES)
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', data.id)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle();
  if (!claimed) {
    return null; // lost the race — already consumed
  }

  return {
    actorId: data.actor_id,
    userId: data.user_id,
    scopes: (data.scopes ?? []) as string[],
    nonce: data.nonce ?? null,
    resource: data.resource ?? null,
  };
}

// ── Token issuance ──────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}

export async function profileClaims(
  userId: string,
  scopes: string[]
): Promise<Record<string, unknown>> {
  if (!scopes.includes('profile') && !scopes.includes('email')) {
    return {};
  }
  const { data: profile } = await adminDb()
    .from(DATABASE_TABLES.PROFILES)
    .select('username, name, avatar_url, email')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) {
    return {};
  }
  const claims: Record<string, unknown> = {};
  if (scopes.includes('profile')) {
    claims.name = profile.name ?? null;
    claims.preferred_username = profile.username ?? null;
    claims.picture = profile.avatar_url ?? null;
  }
  if (scopes.includes('email')) {
    claims.email = profile.email ?? null;
  }
  return claims;
}

export async function issueTokens(params: {
  client: OAuthClient;
  actorId: string;
  userId: string;
  scopes: string[];
  nonce?: string | null;
  withRefresh?: boolean;
  /**
   * RFC 8707 resource the access token is FOR. It becomes the token's `aud`,
   * so only that resource server accepts it; without one, `aud` stays the
   * client_id (the original "Login with OrangeCat" shape).
   */
  resource?: string | null;
}): Promise<TokenResponse> {
  const { privateKey, kid } = await getSigningKey();
  const scope = params.scopes.join(' ');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: OAUTH_SIGNING_ALG, kid };

  // Access token: carries scope + uid so resolveRequestAuth needs no DB lookup.
  // `client_id` (RFC 9068) names the app even when `aud` names a resource.
  const accessToken = await new SignJWT({
    scope,
    uid: params.userId,
    client_id: params.client.client_id,
  })
    .setProtectedHeader(header)
    .setIssuer(OAUTH_ISSUER)
    .setSubject(params.actorId) // sub = actor_id
    .setAudience(params.resource ?? params.client.client_id)
    .setIssuedAt(now)
    .setJti(randomToken(16))
    .setExpirationTime(now + OAUTH_TTL.accessToken)
    .sign(privateKey);

  // ID token: OIDC identity claims (+ profile/email when scoped).
  const idClaims = await profileClaims(params.userId, params.scopes);
  const idToken = await new SignJWT({
    ...idClaims,
    uid: params.userId,
    ...(params.nonce ? { nonce: params.nonce } : {}),
  })
    .setProtectedHeader(header)
    .setIssuer(OAUTH_ISSUER)
    .setSubject(params.actorId)
    .setAudience(params.client.client_id)
    .setIssuedAt(now)
    .setJti(randomToken(16))
    .setExpirationTime(now + OAUTH_TTL.accessToken)
    .sign(privateKey);

  let refresh_token: string | undefined;
  if (params.withRefresh !== false) {
    refresh_token = randomToken(32);
    const { error } = await adminDb()
      .from(DATABASE_TABLES.OAUTH_REFRESH_TOKENS)
      .insert({
        token_hash: sha256(refresh_token),
        client_id: params.client.client_id,
        actor_id: params.actorId,
        user_id: params.userId,
        scopes: params.scopes,
        resource: params.resource ?? null,
        expires_at: new Date(Date.now() + OAUTH_TTL.refreshToken * 1000).toISOString(),
      });
    if (error) {
      logger.warn('Failed to persist refresh token', { error: error.message }, 'OAuth');
      refresh_token = undefined; // degrade to no refresh rather than hand out an unusable one
    }
  }

  return {
    access_token: accessToken,
    id_token: idToken,
    refresh_token,
    token_type: 'Bearer',
    expires_in: OAUTH_TTL.accessToken,
    scope,
  };
}

/**
 * Rotate a refresh token: verify, revoke the old, issue a fresh set bound to
 * the same resource. A mismatched `resource` answers INVALID_TARGET before
 * anything is revoked, so the client keeps a working token.
 */
export async function rotateRefreshToken(
  refreshToken: string,
  client: OAuthClient,
  opts: { resource?: string | null } = {}
): Promise<TokenResponse | typeof INVALID_TARGET | null> {
  const db = adminDb();
  const { data } = await db
    .from(DATABASE_TABLES.OAUTH_REFRESH_TOKENS)
    .select('*')
    .eq('token_hash', sha256(refreshToken))
    .maybeSingle();

  if (!data || data.revoked_at || data.client_id !== client.client_id) {
    return null;
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return null;
  }
  if (!resourceMatches(data.resource ?? null, opts.resource)) {
    return INVALID_TARGET;
  }

  // Revoke (rotate) — conditional to avoid double-rotation races.
  const { data: revoked } = await db
    .from(DATABASE_TABLES.OAUTH_REFRESH_TOKENS)
    .update({ revoked_at: new Date().toISOString(), last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
  if (!revoked) {
    return null;
  }

  return issueTokens({
    client,
    actorId: data.actor_id,
    userId: data.user_id,
    scopes: (data.scopes ?? []) as string[],
    withRefresh: true,
    resource: data.resource ?? null,
  });
}

// ── Remembered consent (skip screen for trusted clients) ────────────────────

export async function hasRememberedGrant(
  userId: string,
  clientId: string,
  scopes: string[]
): Promise<boolean> {
  const { data } = await adminDb()
    .from(DATABASE_TABLES.OAUTH_USER_GRANTS)
    .select('scopes')
    .eq('user_id', userId)
    .eq('client_id', clientId)
    .maybeSingle();
  if (!data) {
    return false;
  }
  const granted = new Set((data.scopes ?? []) as string[]);
  return scopes.every(s => granted.has(s));
}

export async function recordGrant(
  userId: string,
  clientId: string,
  scopes: string[]
): Promise<void> {
  await adminDb()
    .from(DATABASE_TABLES.OAUTH_USER_GRANTS)
    .upsert(
      { user_id: userId, client_id: clientId, scopes, granted_at: new Date().toISOString() },
      { onConflict: 'user_id,client_id' }
    );
}

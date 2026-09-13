/**
 * OIDC provider — single source of truth for issuer, endpoints, and scopes.
 *
 * OrangeCat acts as the platform's OAuth2/OIDC authorization server ("Login with
 * OrangeCat"): the front door through which Loki and future clients adopt
 * one identity (`sub` = `actor_id`) and one economy. See
 * docs/architecture/PLATFORM_AND_COLLABORATION.md and the Loki-repo
 * cross-product-identity-bridge.md.
 *
 * Everything downstream (discovery doc, JWKS, /authorize, /token, /userinfo)
 * derives its URLs and scope list from here — never hardcode them elsewhere.
 */

/**
 * The token issuer. MUST be stable forever once clients are live (it is pinned
 * into every token's `iss` and into relying-party config). Overridable via env
 * for local dev / preview; defaults to production.
 */
export const OAUTH_ISSUER = process.env.OAUTH_ISSUER ?? 'https://orangecat.ch';

/** Token signing algorithm. RS256 so relying parties verify via JWKS. */
export const OAUTH_SIGNING_ALG = 'RS256' as const;

/** Relative paths (the SSOT for route locations). */
export const OAUTH_PATHS = {
  discovery: '/.well-known/openid-configuration',
  authorize: '/oauth/authorize',
  token: '/oauth/token',
  userinfo: '/oauth/userinfo',
  jwks: '/oauth/jwks.json',
} as const;

/** Absolute endpoint URLs, built from the issuer. */
export const oauthUrl = (path: string): string => `${OAUTH_ISSUER}${path}`;

/**
 * Supported scopes. Capability scopes follow the `${entityType}.write` /
 * `${entityType}.read` convention enforced by the v1 entity handlers
 * (resolveRequestAuth.hasScope is a literal match — no wildcards), so a token
 * granted `project.write` can create projects via /api/v1/projects.
 *
 * `description` powers the consent screen; keep it user-facing and honest.
 */
export interface OAuthScope {
  name: string;
  description: string;
  /** OIDC standard scopes are always offered; capability scopes are opt-in. */
  standard?: boolean;
}

export const OAUTH_SCOPES: readonly OAuthScope[] = [
  { name: 'openid', description: 'Sign you in with your OrangeCat identity', standard: true },
  {
    name: 'profile',
    description: 'Read your public profile (name, username, picture)',
    standard: true,
  },
  { name: 'email', description: 'Read your email address', standard: true },
  { name: 'project.read', description: 'See your projects' },
  { name: 'project.write', description: 'Create and update projects on your behalf' },
  { name: 'timeline.write', description: 'Post updates to your wall on your behalf' },
  { name: 'stakeholders.read', description: 'Read stakeholder relationships on your projects' },
  { name: 'stakeholders.write', description: 'Add stakeholder relationships on your projects' },
  { name: 'wallet.read', description: 'See your wallet balances and payment methods' },
  { name: 'messages.read', description: 'Read your messages' },
  { name: 'messages.write', description: 'Send messages on your behalf' },
  { name: 'roles.write', description: 'Post collaborator roles on your projects' },
] as const;

export const SUPPORTED_SCOPE_NAMES: readonly string[] = OAUTH_SCOPES.map(s => s.name);

/** Validate a requested scope string ("openid profile project.write") against the registry. */
export function parseAndValidateScopes(raw: string | null | undefined): {
  granted: string[];
  unknown: string[];
} {
  const requested = (raw ?? '').split(/\s+/).filter(Boolean);
  const granted: string[] = [];
  const unknown: string[] = [];
  for (const s of requested) {
    if (SUPPORTED_SCOPE_NAMES.includes(s)) {
      granted.push(s);
    } else {
      unknown.push(s);
    }
  }
  return { granted: Array.from(new Set(granted)), unknown };
}

/** Token lifetimes (seconds). */
export const OAUTH_TTL = {
  authCode: 60, // single-use, short
  accessToken: 60 * 60, // 1 hour
  refreshToken: 60 * 60 * 24 * 30, // 30 days
} as const;

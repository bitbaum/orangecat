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
import { API_ROUTES } from '@/config/api-routes';

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
  /** RFC 7591 Dynamic Client Registration — how AI apps (MCP clients) sign up. */
  register: '/oauth/register',
  /** RFC 8414 — the same metadata as `discovery`, at the path MCP clients probe. */
  authorizationServerMetadata: '/.well-known/oauth-authorization-server',
  /** RFC 9728 — which authorization server protects OrangeCat's MCP endpoint. */
  protectedResourceMetadata: '/.well-known/oauth-protected-resource',
  /** OrangeCat's own MCP server (Streamable HTTP). */
  mcp: API_ROUTES.MCP,
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
  /**
   * Reads private data or acts in the person's name. The consent screen lists
   * these first, marked, so "send messages as you" never reads with the same
   * weight as "sign you in".
   */
  sensitive?: boolean;
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
  {
    name: 'project.write',
    sensitive: true,
    description: 'Create and update projects on your behalf',
  },
  {
    name: 'timeline.write',
    sensitive: true,
    description: 'Post updates to your wall on your behalf',
  },
  { name: 'stakeholders.read', description: 'Read stakeholder relationships on your projects' },
  {
    name: 'stakeholders.write',
    sensitive: true,
    description: 'Add stakeholder relationships on your projects',
  },
  {
    name: 'wallet.read',
    sensitive: true,
    description: 'See your wallet balances and payment methods',
  },
  { name: 'messages.read', sensitive: true, description: 'Read your messages' },
  { name: 'messages.write', sensitive: true, description: 'Send messages on your behalf' },
  { name: 'roles.write', sensitive: true, description: 'Post collaborator roles on your projects' },
  // Loki scopes. OrangeCat only MINTS these; Loki's MCP server is the resource
  // that honours them (see OAUTH_RESOURCES.loki below).
  { name: 'loki.chat', description: 'Talk to Loki and see what your fleet is doing' },
  {
    name: 'loki.act',
    sensitive: true,
    description:
      'Let Loki act for you: dispatch work to your projects, book appointments, and approve or reject queued actions — approving runs the action',
  },
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

/** The OIDC scopes every client may ask for, whatever resource it targets. */
export const STANDARD_SCOPE_NAMES: readonly string[] = OAUTH_SCOPES.filter(s => s.standard).map(
  s => s.name
);

// ── Resources (RFC 8707) ─────────────────────────────────────────────────────

/**
 * A protected resource an access token can be minted FOR. The token's `aud` is
 * the resource's `uri`, and that resource server rejects tokens minted for any
 * other — which is what stops a token handed to Loki from being replayed at
 * OrangeCat, and the reverse.
 *
 * `scopes` is the ceiling a token for this resource may carry (plus the
 * standard OIDC scopes), and what its protected-resource metadata advertises.
 */
export interface OAuthResource {
  /** The canonical resource identifier — exactly what goes into `aud`. */
  uri: string;
  /** Shown on the consent screen: "… to use <name> for you". */
  name: string;
  scopes: readonly string[];
}

export const OAUTH_RESOURCES = {
  orangecat: {
    uri: oauthUrl(OAUTH_PATHS.mcp),
    name: 'OrangeCat',
    // What the OrangeCat MCP tools gate on (src/services/mcp/tools.ts) —
    // mcp-server.test.ts fails if a tool names a scope missing here.
    scopes: ['project.read', 'project.write', 'timeline.write'],
  },
  loki: {
    uri: process.env.LOKI_MCP_RESOURCE ?? 'https://loki.orangecat.ch/api/mcp',
    name: 'Loki',
    scopes: ['loki.chat', 'loki.act'],
  },
} as const satisfies Record<string, OAuthResource>;

export type OAuthResourceId = keyof typeof OAUTH_RESOURCES;

/**
 * Resolve a `resource` parameter to a known resource, or null. Comparison is
 * exact apart from one trailing slash, which clients disagree about when they
 * canonicalise a server URL; nothing else is normalised (no case folding, no
 * default ports) so an attacker-chosen spelling can never alias a real one.
 */
export function findOAuthResource(raw: string | null | undefined): OAuthResource | null {
  if (!raw) {
    return null;
  }
  const wanted = raw.endsWith('/') ? raw.slice(0, -1) : raw;
  return Object.values(OAUTH_RESOURCES).find(r => r.uri === wanted) ?? null;
}

/**
 * The scopes a request may end up with, before the client's own ceiling.
 *
 *  - No resource: whatever was asked for (legacy "Login with OrangeCat").
 *  - Resource, nothing asked for: that resource's scopes. claude.ai and other
 *    MCP clients often send no `scope` at all and expect the server's defaults.
 *  - Resource and scopes: only the standard ones and the resource's own — a
 *    Loki token never carries `project.write`, which Loki could not honour.
 */
export function scopesForResource(requested: string[], resource: OAuthResource | null): string[] {
  if (!resource) {
    return requested;
  }
  if (requested.length === 0) {
    return [...resource.scopes];
  }
  return requested.filter(s => STANDARD_SCOPE_NAMES.includes(s) || resource.scopes.includes(s));
}

/** How an OAuth client came to exist — shown on the consent screen. */
export const OAUTH_CLIENT_ORIGINS = {
  /** Registered by an OrangeCat operator (Loki, Solon, …). */
  admin: 'admin',
  /** Registered itself through /oauth/register. Nobody at OrangeCat checked it. */
  dcr: 'dcr',
} as const;
export type OAuthClientOrigin = (typeof OAUTH_CLIENT_ORIGINS)[keyof typeof OAUTH_CLIENT_ORIGINS];

/** Token lifetimes (seconds). */
export const OAUTH_TTL = {
  authCode: 60, // single-use, short
  accessToken: 60 * 60, // 1 hour
  refreshToken: 60 * 60 * 24 * 30, // 30 days
} as const;

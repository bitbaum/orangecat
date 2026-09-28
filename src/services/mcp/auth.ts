/**
 * Who is calling OrangeCat's MCP server (/api/mcp).
 *
 * Two kinds of bearer are accepted, and nothing else (no session cookie — an
 * MCP client is never a browser tab signed in to orangecat.ch):
 *
 *  1. An OrangeCat access token minted FOR this server: signature + issuer, and
 *     `aud` must equal OAUTH_RESOURCES.orangecat.uri (RFC 8707). A token minted
 *     for Loki, or a plain "Login with OrangeCat" token (`aud` = client_id), is
 *     refused — that audience check is what keeps each server's tokens its own.
 *     This is deliberately stricter than /api/v1, which predates resources.
 *  2. An integration key (`ock_…`), for clients configured by hand (Claude Code
 *     and Cursor config files) — the same keys /api/v1 accepts.
 *
 * Failure is an HTTP 401 carrying RFC 9728's `resource_metadata` pointer, which
 * is how an MCP client discovers where to send the person to sign in.
 */
import { OAUTH_ISSUER, OAUTH_PATHS, OAUTH_RESOURCES, oauthUrl } from '@/lib/oauth/config';
import { OPEN_CORS_HEADERS } from '@/lib/oauth/metadata';
import { verifyIntegrationKey } from '@/services/auth/integrationKeys';

export interface McpCaller {
  userId: string;
  /** The actor every read and write is scoped to (`sub` / the key's actor). */
  actorId: string;
  scopes: string[];
  source: 'oidc' | 'integration_key';
  /** The OAuth client for token callers; null for integration keys. */
  clientId: string | null;
  /** The presented bearer, forwarded when a tool reuses a /api/v1 handler. */
  bearer: string;
}

export type McpAuthResult = { ok: true; caller: McpCaller } | { ok: false; response: Response };

const BEARER_PREFIX = 'Bearer ';

/** The RFC 9728 document a 401 points at. */
export const MCP_RESOURCE_METADATA_URL = oauthUrl(OAUTH_PATHS.protectedResourceMetadata);

/**
 * 401 with the challenge MCP clients act on. `invalidToken` adds RFC 6750's
 * `error="invalid_token"` — set when a bearer was presented but refused, so a
 * client knows to refresh or re-authorize rather than just sign in.
 */
export function mcpUnauthorized(invalidToken: boolean): Response {
  const params = [
    `resource_metadata="${MCP_RESOURCE_METADATA_URL}"`,
    ...(invalidToken
      ? [
          'error="invalid_token"',
          'error_description="The access token is invalid, expired, or not for this server"',
        ]
      : []),
  ];
  return Response.json(
    {
      error: invalidToken ? 'invalid_token' : 'unauthorized',
      error_description: invalidToken
        ? 'The access token is invalid, expired, or was not issued for this server.'
        : `Sign in with OrangeCat to use this server. Authorization server: ${OAUTH_ISSUER}`,
    },
    {
      status: 401,
      headers: {
        ...OPEN_CORS_HEADERS,
        'Cache-Control': 'no-store',
        'WWW-Authenticate': `Bearer ${params.join(', ')}`,
      },
    }
  );
}

export async function authenticateMcpRequest(req: Request): Promise<McpAuthResult> {
  const header = req.headers.get('authorization');
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    return { ok: false, response: mcpUnauthorized(false) };
  }
  const bearer = header.slice(BEARER_PREFIX.length).trim();
  if (!bearer) {
    return { ok: false, response: mcpUnauthorized(false) };
  }

  if (bearer.startsWith('ock_')) {
    const key = await verifyIntegrationKey(bearer);
    if (!key) {
      return { ok: false, response: mcpUnauthorized(true) };
    }
    return {
      ok: true,
      caller: {
        userId: key.userId,
        actorId: key.actorId,
        scopes: key.scopes,
        source: 'integration_key',
        clientId: null,
        bearer,
      },
    };
  }

  // Lazy import: keeps `jose` out of the static graph of anything that only
  // needs the types or the 401 above.
  const { verifyAccessToken } = await import('@/lib/oauth/keys');
  const payload = await verifyAccessToken(bearer, { audience: OAUTH_RESOURCES.orangecat.uri });
  const uid = typeof payload?.uid === 'string' ? payload.uid : '';
  if (!payload?.sub || !uid) {
    return { ok: false, response: mcpUnauthorized(true) };
  }
  const scope = typeof payload.scope === 'string' ? payload.scope : '';
  return {
    ok: true,
    caller: {
      userId: uid,
      actorId: payload.sub,
      scopes: scope.split(/\s+/).filter(Boolean),
      source: 'oidc',
      clientId: typeof payload.client_id === 'string' ? payload.client_id : null,
      bearer,
    },
  };
}

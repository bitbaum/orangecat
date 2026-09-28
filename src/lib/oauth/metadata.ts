/**
 * Discovery documents — one builder per document, every value from config.ts.
 *
 * The same authorization-server metadata is served at two addresses: OIDC
 * relying parties (Loki's Auth.js, Solon) read /.well-known/openid-configuration,
 * and MCP clients (claude.ai, ChatGPT, Claude Code) probe RFC 8414's
 * /.well-known/oauth-authorization-server first. Two routes, one object — so the
 * two can never disagree about an endpoint.
 *
 * The protected-resource document (RFC 9728) is what an MCP client reads after
 * /api/mcp answers 401: it names OrangeCat as the authorization server and says
 * which scopes the resource understands.
 */
import {
  OAUTH_ISSUER,
  OAUTH_PATHS,
  OAUTH_RESOURCES,
  OAUTH_SIGNING_ALG,
  SUPPORTED_SCOPE_NAMES,
  oauthUrl,
} from './config';

export function buildAuthorizationServerMetadata() {
  return {
    issuer: OAUTH_ISSUER,
    authorization_endpoint: oauthUrl(OAUTH_PATHS.authorize),
    token_endpoint: oauthUrl(OAUTH_PATHS.token),
    userinfo_endpoint: oauthUrl(OAUTH_PATHS.userinfo),
    jwks_uri: oauthUrl(OAUTH_PATHS.jwks),
    registration_endpoint: oauthUrl(OAUTH_PATHS.register),
    scopes_supported: SUPPORTED_SCOPE_NAMES,
    response_types_supported: ['code'],
    // OIDC Prompt Create 1.0: a relying party may open straight on sign-up.
    prompt_values_supported: ['create'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: [OAUTH_SIGNING_ALG],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    code_challenge_methods_supported: ['S256'],
    claims_supported: [
      'sub',
      'iss',
      'aud',
      'exp',
      'iat',
      'name',
      'preferred_username',
      'picture',
      'email',
    ],
  };
}

/** RFC 9728 metadata for OrangeCat's own MCP server. */
export function buildProtectedResourceMetadata() {
  const resource = OAUTH_RESOURCES.orangecat;
  return {
    resource: resource.uri,
    authorization_servers: [OAUTH_ISSUER],
    scopes_supported: [...resource.scopes],
    bearer_methods_supported: ['header'],
    resource_name: resource.name,
  };
}

/**
 * CORS for the endpoints AI apps reach from a browser (the MCP endpoint, the
 * discovery documents, registration). Permissive by design: none of them read
 * cookies, and every one either is public or demands a bearer token — so an
 * arbitrary origin gains nothing a server-side caller would not already have.
 */
export const OPEN_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id, Mcp-Protocol-Version',
  'Access-Control-Max-Age': '86400',
};

/** A preflight answer for any of those endpoints. */
export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: OPEN_CORS_HEADERS });
}

/** A cacheable JSON discovery document, with CORS. */
export function metadataResponse(doc: object): Response {
  return Response.json(doc, {
    headers: { ...OPEN_CORS_HEADERS, 'Cache-Control': 'public, max-age=3600' },
  });
}

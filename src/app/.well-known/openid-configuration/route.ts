/**
 * OIDC discovery document.
 *
 * GET /.well-known/openid-configuration — lets relying parties (Loki's
 * Auth.js generic OIDC provider, etc.) auto-configure. All URLs + the scope list
 * derive from the OAuth config SSOT.
 */
import { NextResponse } from 'next/server';
import {
  OAUTH_ISSUER,
  OAUTH_PATHS,
  OAUTH_SIGNING_ALG,
  SUPPORTED_SCOPE_NAMES,
  oauthUrl,
} from '@/lib/oauth/config';

// Must read OAUTH_ISSUER from the runtime env (the box), not bake the build-time
// value — otherwise the advertised issuer/endpoints would be wrong in prod.
// Cached via Cache-Control below; cheap and rarely hit.
export const dynamic = 'force-dynamic';

export function GET() {
  const doc = {
    issuer: OAUTH_ISSUER,
    authorization_endpoint: oauthUrl(OAUTH_PATHS.authorize),
    token_endpoint: oauthUrl(OAUTH_PATHS.token),
    userinfo_endpoint: oauthUrl(OAUTH_PATHS.userinfo),
    jwks_uri: oauthUrl(OAUTH_PATHS.jwks),
    scopes_supported: SUPPORTED_SCOPE_NAMES,
    response_types_supported: ['code'],
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

  return NextResponse.json(doc, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}

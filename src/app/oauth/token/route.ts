/**
 * OAuth2 token endpoint.
 *
 * POST /oauth/token (application/x-www-form-urlencoded)
 *   - grant_type=authorization_code: code, redirect_uri, client_id, code_verifier,
 *     [client_secret for confidential clients] → access/id/refresh tokens.
 *   - grant_type=refresh_token: refresh_token, client_id, [client_secret] → fresh access token
 *     (refresh token rotated for public clients, kept + slid for confidential ones).
 *   - Either grant may repeat `resource` (RFC 8707). It must be the resource the
 *     grant was bound to at /oauth/authorize; anything else is `invalid_target`.
 *     Omitting it keeps the bound one — the token's `aud` never changes.
 *
 * Errors follow RFC 6749 §5.2 ({ error, error_description }, 400). Tokens are
 * never cached.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getClient,
  verifyClientSecret,
  consumeAuthCode,
  issueTokens,
  rotateRefreshToken,
  INVALID_TARGET,
  type OAuthClient,
} from '@/services/auth/oauthProvider';
import { findOAuthResource } from '@/lib/oauth/config';
import { OPEN_CORS_HEADERS, corsPreflight } from '@/lib/oauth/metadata';
import { logger } from '@/utils/logger';

export const dynamic = 'force-dynamic';

// CORS: browser-based MCP clients redeem codes from their own origin. No
// cookie is read here — a code is worthless without its PKCE verifier.
const NO_STORE = { 'Cache-Control': 'no-store', Pragma: 'no-cache', ...OPEN_CORS_HEADERS };

function err(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: NO_STORE }
  );
}

/** Authenticate the client: confidential → secret; public → must use PKCE (no secret). */
async function authenticateClient(
  clientId: string | null,
  clientSecret: string | null
): Promise<{ client: OAuthClient } | { error: NextResponse }> {
  if (!clientId) {
    return { error: err('invalid_request', 'client_id is required') };
  }
  const client = await getClient(clientId);
  if (!client) {
    return { error: err('invalid_client', 'unknown or disabled client', 401) };
  }
  if (client.is_confidential && !verifyClientSecret(client, clientSecret)) {
    return { error: err('invalid_client', 'client authentication failed', 401) };
  }
  return { client };
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err('invalid_request', 'expected application/x-www-form-urlencoded body');
  }
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === 'string' ? v : null;
  };

  const grantType = get('grant_type');
  const auth = await authenticateClient(get('client_id'), get('client_secret'));
  if ('error' in auth) {
    return auth.error;
  }
  const { client } = auth;

  // RFC 8707: an unknown resource is refused before any grant is looked at.
  const rawResource = get('resource');
  const resource = rawResource ? findOAuthResource(rawResource) : null;
  if (rawResource && !resource) {
    return err(INVALID_TARGET, 'resource is not a resource this server issues tokens for');
  }
  const targetMismatch = () =>
    err(INVALID_TARGET, 'resource does not match the one this grant was issued for');

  try {
    if (grantType === 'authorization_code') {
      const code = get('code');
      const redirectUri = get('redirect_uri');
      const codeVerifier = get('code_verifier');
      if (!code || !redirectUri || !codeVerifier) {
        return err('invalid_request', 'code, redirect_uri, and code_verifier are required');
      }
      const consumed = await consumeAuthCode(code, {
        clientId: client.client_id,
        redirectUri,
        codeVerifier,
        resource: resource?.uri,
      });
      if (consumed === INVALID_TARGET) {
        return targetMismatch();
      }
      if (!consumed) {
        return err('invalid_grant', 'authorization code invalid, expired, or already used');
      }
      const tokens = await issueTokens({
        client,
        actorId: consumed.actorId,
        userId: consumed.userId,
        scopes: consumed.scopes,
        nonce: consumed.nonce,
        resource: consumed.resource,
      });
      return NextResponse.json(tokens, { headers: NO_STORE });
    }

    if (grantType === 'refresh_token') {
      const refreshToken = get('refresh_token');
      if (!refreshToken) {
        return err('invalid_request', 'refresh_token is required');
      }
      const tokens = await rotateRefreshToken(refreshToken, client, { resource: resource?.uri });
      if (tokens === INVALID_TARGET) {
        return targetMismatch();
      }
      if (!tokens) {
        return err('invalid_grant', 'refresh token invalid, expired, or revoked');
      }
      return NextResponse.json(tokens, { headers: NO_STORE });
    }

    return err('unsupported_grant_type', `grant_type '${grantType}' is not supported`);
  } catch (error) {
    logger.error('Token endpoint failure', error, 'OAuth');
    return err('server_error', 'could not issue tokens', 500);
  }
}

export function OPTIONS() {
  return corsPreflight();
}

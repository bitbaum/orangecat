/**
 * OIDC userinfo endpoint.
 *
 * GET /oauth/userinfo  (Authorization: Bearer <access_token>)
 * Returns the standard claims for the token's subject: `sub` (= actor_id) always,
 * plus profile/email claims when those scopes were granted.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/oauth/keys';
import { profileClaims } from '@/services/auth/oidcProfileClaims';

export const dynamic = 'force-dynamic';

function unauthorized(description: string) {
  return NextResponse.json(
    { error: 'invalid_token', error_description: description },
    {
      status: 401,
      headers: {
        'Cache-Control': 'no-store',
        'WWW-Authenticate': `Bearer error="invalid_token", error_description="${description}"`,
      },
    }
  );
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized('a Bearer access token is required');
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const payload = await verifyAccessToken(token);
  if (!payload?.sub) {
    return unauthorized('the access token is invalid or expired');
  }

  const scopes =
    typeof payload.scope === 'string' ? payload.scope.split(/\s+/).filter(Boolean) : [];
  const userId = typeof payload.uid === 'string' ? payload.uid : '';

  // `client_id` (RFC 9068) names the app the token was issued to, so what the
  // person withheld from THAT app stays withheld here too.
  const clientId = typeof payload.client_id === 'string' ? payload.client_id : undefined;

  const claims: Record<string, unknown> = { sub: payload.sub };
  if (userId) {
    Object.assign(claims, await profileClaims(userId, scopes, clientId));
  }

  return NextResponse.json(claims, { headers: { 'Cache-Control': 'no-store' } });
}

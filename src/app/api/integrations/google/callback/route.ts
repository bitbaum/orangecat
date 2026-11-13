/**
 * GET /api/integrations/google/callback — Google sends the person back here.
 *
 *   error                → they declined: back to Controls, "denied"
 *   state matches cookie → exchange the code, read the address, store encrypted
 *   anything else        → refuse
 *
 * A person can untick mail or calendar on Google's screen. A connection with
 * neither is not kept; one with only one of them is, and the read that needs
 * the other says so when it is asked.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { getAdminClient } from '@/lib/supabase/admin';
import { SITE_URL } from '@/config/brand';
import { CAT_HUB_TAB_HREFS } from '@/config/cat-hub';
import {
  GOOGLE_SCOPES,
  exchangeGoogleCode,
  googleGet,
  missingGoogleScopes,
  saveGoogleConnection,
} from '@/services/google/connection';
import { GOOGLE_STATE_COOKIE, GOOGLE_STATE_PATH, decideGoogleReturn } from '../state';

function back(outcome: 'connected' | 'denied' | 'failed'): NextResponse {
  const url = new URL(CAT_HUB_TAB_HREFS.controls, SITE_URL);
  url.searchParams.set('google', outcome);
  const res = NextResponse.redirect(url);
  res.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: GOOGLE_STATE_PATH });
  return res;
}

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const req = request as unknown as NextRequest;
  const params = req.nextUrl.searchParams;
  const decision = decideGoogleReturn({
    error: params.get('error'),
    state: params.get('state'),
    cookieState: req.cookies.get(GOOGLE_STATE_COOKIE)?.value,
    code: params.get('code'),
  });
  if (decision !== 'exchange') {
    return back(decision);
  }
  const tokens = await exchangeGoogleCode(params.get('code') as string);
  if (!tokens || missingGoogleScopes(tokens.scopes).length === GOOGLE_SCOPES.length) {
    return back('failed');
  }
  // The address the mailbox answers to; absent when mail was unticked.
  const profile = await googleGet<{ emailAddress?: string }>(
    tokens.accessToken,
    'https://gmail.googleapis.com/gmail/v1/users/me/profile'
  );
  const saved = await saveGoogleConnection(
    getAdminClient(),
    request.user.id,
    profile.ok ? (profile.data.emailAddress ?? null) : null,
    tokens
  );
  return back(saved ? 'connected' : 'failed');
});

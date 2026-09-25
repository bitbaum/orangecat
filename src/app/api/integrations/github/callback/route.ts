/**
 * GET /api/integrations/github/callback — GitHub sends the person back here.
 *
 *   error                 → they declined: back to Controls, "denied"
 *   state matches cookie  → exchange the code, read the login, store encrypted
 *   no state at all       → returning from the install page, where GitHub does
 *                           not promise to carry state: the incoming code is
 *                           NOT used; restart the standard authorisation with
 *                           a fresh state (instant — they already approved)
 *   state wrong           → refuse
 *
 * The decision is decideGitHubReturn (../state), so it is tested without HTTP.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { getAdminClient } from '@/lib/supabase/admin';
import { SITE_URL } from '@/config/brand';
import { CAT_HUB_TAB_HREFS } from '@/config/cat-hub';
import {
  exchangeGitHubCode,
  githubAuthorizeUrl,
  githubGet,
  saveGitHubConnection,
} from '@/services/github/connection';
import {
  GITHUB_STATE_COOKIE,
  decideGitHubReturn,
  newGitHubState,
  setGitHubStateCookie,
} from '../state';

function back(outcome: 'connected' | 'denied' | 'failed'): NextResponse {
  const url = new URL(CAT_HUB_TAB_HREFS.controls, SITE_URL);
  url.searchParams.set('github', outcome);
  const res = NextResponse.redirect(url);
  res.cookies.delete({ name: GITHUB_STATE_COOKIE, path: '/api/integrations/github' });
  return res;
}

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const req = request as unknown as NextRequest;
  const params = req.nextUrl.searchParams;
  const decision = decideGitHubReturn({
    error: params.get('error'),
    state: params.get('state'),
    cookieState: req.cookies.get(GITHUB_STATE_COOKIE)?.value,
    code: params.get('code'),
    installationId: params.get('installation_id'),
  });

  if (decision === 'denied' || decision === 'failed') {
    return back(decision);
  }
  if (decision === 'reauthorize') {
    const fresh = newGitHubState();
    return setGitHubStateCookie(NextResponse.redirect(githubAuthorizeUrl(fresh)), fresh);
  }

  const tokens = await exchangeGitHubCode(params.get('code') as string);
  if (!tokens) {
    return back('failed');
  }
  const me = await githubGet<{ login?: string }>(tokens.accessToken, '/user');
  const saved = await saveGitHubConnection(
    getAdminClient(),
    request.user.id,
    me?.login ?? null,
    tokens
  );
  return back(saved ? 'connected' : 'failed');
});

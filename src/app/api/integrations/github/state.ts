/**
 * The OAuth `state` between our redirect to GitHub and GitHub's return.
 * httpOnly, scoped to /api/integrations/github, ten minutes.
 */
import { randomBytes, timingSafeEqual } from 'crypto';
import type { NextResponse } from 'next/server';

export const GITHUB_STATE_COOKIE = 'oc_github_state';

export function newGitHubState(): string {
  return randomBytes(24).toString('base64url');
}

export function setGitHubStateCookie(res: NextResponse, state: string): NextResponse {
  res.cookies.set(GITHUB_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/integrations/github',
    maxAge: 10 * 60,
  });
  return res;
}

export type GitHubReturn = 'denied' | 'failed' | 'reauthorize' | 'exchange';

function sameState(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * What to do with GitHub's return (see the callback route). A code is only
 * ever exchanged when it arrives with the state we set.
 */
export function decideGitHubReturn(r: {
  error: string | null;
  state: string | null;
  cookieState: string | null | undefined;
  code: string | null;
  installationId: string | null;
}): GitHubReturn {
  if (r.error) {
    return 'denied';
  }
  if (!r.state) {
    return r.code || r.installationId ? 'reauthorize' : 'failed';
  }
  if (!sameState(r.state, r.cookieState)) {
    return 'failed';
  }
  return r.code ? 'exchange' : 'failed';
}

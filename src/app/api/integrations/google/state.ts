/**
 * The OAuth `state` between our redirect to Google and Google's return.
 * httpOnly, scoped to /api/integrations/google, ten minutes. Google always
 * carries `state` back, so a code is exchanged only when it arrives with the
 * state we set.
 */
import { randomBytes, timingSafeEqual } from 'crypto';
import type { NextResponse } from 'next/server';

export const GOOGLE_STATE_COOKIE = 'oc_google_state';
export const GOOGLE_STATE_PATH = '/api/integrations/google';

export function newGoogleState(): string {
  return randomBytes(24).toString('base64url');
}

export function setGoogleStateCookie(res: NextResponse, state: string): NextResponse {
  res.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: GOOGLE_STATE_PATH,
    maxAge: 10 * 60,
  });
  return res;
}

export type GoogleReturn = 'denied' | 'failed' | 'exchange';

export function decideGoogleReturn(r: {
  error: string | null;
  state: string | null;
  cookieState: string | null | undefined;
  code: string | null;
}): GoogleReturn {
  if (r.error) {
    return 'denied';
  }
  const { state, cookieState } = r;
  if (!state || !cookieState || state.length !== cookieState.length) {
    return 'failed';
  }
  if (!timingSafeEqual(Buffer.from(state), Buffer.from(cookieState))) {
    return 'failed';
  }
  return r.code ? 'exchange' : 'failed';
}

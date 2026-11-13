/**
 * GET /api/integrations/google/connect — start connecting a Google account.
 *
 * Sends the person to Google's consent screen for mail and calendar,
 * read-only, with a one-time `state` in an httpOnly cookie. The callback
 * trusts only a code that comes back with that state.
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { apiError } from '@/lib/api/standardResponse';
import { googleAuthorizeUrl, googleConnectionConfigured } from '@/services/google/connection';
import { newGoogleState, setGoogleStateCookie } from '../state';

export const GET = withAuth(async () => {
  if (!googleConnectionConfigured()) {
    return apiError('Google connection is not set up on this server yet.', 'NOT_CONFIGURED', 503);
  }
  const state = newGoogleState();
  return setGoogleStateCookie(NextResponse.redirect(googleAuthorizeUrl(state)), state);
});

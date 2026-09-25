/**
 * GET /api/integrations/github/connect — start connecting GitHub to Cat.
 *
 * Sends the person to the GitHub App's install page to choose which
 * repositories Cat may read (read-only), with a one-time `state` in an
 * httpOnly cookie. The callback trusts only a code that comes back with that
 * state — see services/github/connection.
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { apiError } from '@/lib/api/standardResponse';
import { githubConnectionConfigured, githubInstallUrl } from '@/services/github/connection';
import { newGitHubState, setGitHubStateCookie } from '../state';

export const GET = withAuth(async () => {
  if (!githubConnectionConfigured()) {
    return apiError('GitHub connection is not set up on this server yet.', 'NOT_CONFIGURED', 503);
  }
  const state = newGitHubState();
  return setGitHubStateCookie(NextResponse.redirect(githubInstallUrl(state)), state);
});

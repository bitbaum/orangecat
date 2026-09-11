/**
 * POST /api/client-errors — where a crash in the browser goes.
 *
 * Until now it went nowhere. `setErrorSink` (utils/logger) was written for
 * exactly this and never called, so an error boundary logged to the visitor's
 * own console and the server learned nothing. "Which pages fail?" was
 * unanswerable from inside the product — which is why a report of "some pages
 * show Something went wrong" could not be turned into a list of pages.
 *
 * This is deliberately not an error-tracking product: one structured line per
 * crash into the journal, where every other server error already lives and is
 * greppable by `source: "client"`. No third-party, no new table, no PII beyond
 * the route and the user id when there is a session.
 *
 * Untrusted input: every field is capped and stringified; nothing is executed,
 * rendered or trusted. Rate-limited like any write.
 */
import { NextRequest, NextResponse } from 'next/server';
import { compose } from '@/lib/api/compose';
import { withRateLimit } from '@/lib/api/withRateLimit';
import { withRequestId } from '@/lib/api/withRequestId';
import { apiSuccess, apiBadRequest } from '@/lib/api/standardResponse';
import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/utils/logger';

const MAX = { message: 500, stack: 4000, route: 300, digest: 64, component: 200 } as const;

function clip(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export const POST = compose(
  withRequestId(),
  withRateLimit('write')
)(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return apiBadRequest('Invalid body');

  const message = clip(body.message, MAX.message);
  if (!message) return apiBadRequest('message is required');

  // Best-effort identity: a crash from a signed-out visitor is still worth
  // seeing, so this never rejects for the lack of a session.
  let userId: string | null = null;
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    /* anonymous */
  }

  logger.error(
    'Client error',
    {
      message,
      route: clip(body.route, MAX.route),
      digest: clip(body.digest, MAX.digest),
      component: clip(body.component, MAX.component),
      stack: clip(body.stack, MAX.stack),
      deploySkew: body.deploySkew === true,
      userId,
      userAgent: clip(request.headers.get('user-agent'), 200),
    },
    'client'
  );

  // 202: recorded, and never a reason for the page to show a second error.
  return apiSuccess({ recorded: true }, { status: 202, cache: 'NONE' }) as NextResponse;
});

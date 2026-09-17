/**
 * Webhook endpoints — mint and list.
 *
 * GET  /api/webhook-endpoints   → list caller's endpoints (no secret)
 * POST /api/webhook-endpoints   → mint a new endpoint, plaintext secret
 *                                 returned ONCE
 *
 * Auth: Supabase session only. Integration keys themselves cannot mint
 * webhook endpoints — same escalation reason as integration keys.
 *
 * Mirrors src/app/api/integration-keys/route.ts on purpose; both are
 * the same actor-bound platform-plumbing pattern.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { compose } from '@/lib/api/compose';
import { withRequestId } from '@/lib/api/withRequestId';
import { withZodBody } from '@/lib/api/withZod';
import { createServerClient } from '@/lib/supabase/server';
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import {
  createWebhookEndpoint,
  listWebhookEndpoints,
  ActorNotPermittedError,
} from '@/services/webhooks/webhookEndpointsService';
import { PUBLIC_API_WEBHOOK_EVENTS } from '@/config/public-api';
import { checkPublicUrl } from '@/lib/security/ssrfGuard';
import { webUrl } from '@/lib/validation/base';

// Validate against the SSOT allowlist instead of accepting any string.
// A curl-mint with event_types=['totally.fake'] would otherwise pass
// validation and then silently never fire — enqueueWebhookEvent's
// `.includes(eventType)` filter excludes everything. Users would see
// no deliveries and have no signal why.
const KNOWN_EVENT_TYPES = PUBLIC_API_WEBHOOK_EVENTS as readonly [string, ...string[]];
const createEndpointSchema = z.object({
  name: z.string().min(1).max(120),
  url: webUrl({ max: 2048 }),
  actor_id: z.string().guid(),
  event_types: z.array(z.enum(KNOWN_EVENT_TYPES)).max(20).optional(),
});

async function requireSessionUser(): Promise<{ id: string } | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export const GET = compose(withRequestId())(async () => {
  try {
    const user = await requireSessionUser();
    if (!user) {
      return apiUnauthorized();
    }
    const endpoints = await listWebhookEndpoints(user.id);
    return apiSuccess({ endpoints });
  } catch (error) {
    return handleApiError(error);
  }
});

export const POST = compose(
  withRequestId(),
  withZodBody(createEndpointSchema)
)(async (_req: NextRequest, ctx) => {
  try {
    const user = await requireSessionUser();
    if (!user) {
      return apiUnauthorized();
    }
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const body = ctx.body as {
      name: string;
      url: string;
      actor_id: string;
      event_types?: string[];
    };
    // https-only in production; localhost allowed in dev for testing.
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd && !body.url.startsWith('https://')) {
      return apiForbidden('Webhook URL must use https in production.');
    }
    // SSRF guard: the worker fetches this URL server-side and stores the
    // response where the owner can read it — never allow internal targets.
    // (Dev keeps localhost receivers working; the worker re-checks in prod.)
    if (isProd) {
      const urlCheck = await checkPublicUrl(body.url);
      if (!urlCheck.ok) {
        return apiForbidden(`Webhook URL rejected: ${urlCheck.reason}.`);
      }
    }
    try {
      const minted = await createWebhookEndpoint({
        userId: user.id,
        actorId: body.actor_id,
        name: body.name,
        url: body.url,
        eventTypes: body.event_types ?? null,
      });
      return apiSuccess({ endpoint: minted.endpoint, secret: minted.secret }, { status: 201 });
    } catch (error) {
      if (error instanceof ActorNotPermittedError) {
        return apiForbidden('You are not permitted to create an endpoint for this actor.');
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
});

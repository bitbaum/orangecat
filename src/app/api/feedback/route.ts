/**
 * Public feedback + Ask Cat API
 *
 * POST /api/feedback — anyone (no account required) sends a question or
 * feedback; Cat answers immediately and the exchange is stored so future
 * answers learn from it. See src/services/cat/platform-feedback.ts.
 *
 * Anonymous-friendly by design, so writes go through the service-role client
 * (RLS has no anon path) after strict per-IP rate limiting.
 */

import type { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { platformFeedbackSchema } from '@/lib/validation';
import { answerAndRecordFeedback } from '@/services/cat/platform-feedback';
import { rateLimit, rateLimitAskCat, retryAfterSeconds } from '@/lib/rate-limit';
import {
  apiSuccess,
  apiBadRequest,
  apiRateLimited,
  apiInternalError,
} from '@/lib/api/standardResponse';
import { logger } from '@/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const general = await rateLimit(request);
    if (!general.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(general));
    }
    const ask = await rateLimitAskCat(request);
    if (!ask.success) {
      return apiRateLimited(
        'The Cat needs a short breather — please try again in a few minutes.',
        retryAfterSeconds(ask)
      );
    }

    const body = await request.json().catch(() => null);
    const v = platformFeedbackSchema.safeParse(body);
    if (!v.success) {
      return apiBadRequest('Invalid request', v.error.issues);
    }

    // Attribute the submission when the visitor happens to be signed in;
    // anonymous is fully supported and the common case.
    let userId: string | null = null;
    try {
      const supabase = await createServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      userId = null;
    }

    const result = await answerAndRecordFeedback(getAdminClient(), {
      message: v.data.message,
      email: v.data.email || null,
      pagePath: v.data.page_path || null,
      userId,
    });

    return apiSuccess({
      kind: result.kind,
      answer: result.answer,
      stored: result.id !== null,
    });
  } catch (error) {
    logger.error('Error in POST /api/feedback', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiInternalError();
  }
}

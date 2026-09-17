/**
 * POST /api/newsletter/subscribe — capture a newsletter signup.
 *
 * Anonymous-friendly by design (a blog reader has no account), so the write
 * goes through the service-role client after per-IP rate limiting —
 * newsletter_subscribers has RLS enabled with no policies, making this route
 * the only path into the table.
 *
 * Idempotent on duplicates: re-subscribing an existing email returns success.
 * That is both the honest UX (the reader IS subscribed) and an anti-harvesting
 * measure — the response never reveals whether an address was already known.
 */

import type { NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { looseClient } from '@/lib/supabase/untyped';
import { DATABASE_TABLES } from '@/config/database-tables';
import { newsletterSubscribeSchema } from '@/lib/validation';
import { rateLimit, retryAfterSeconds } from '@/lib/rate-limit';
import {
  apiSuccess,
  apiBadRequest,
  apiRateLimited,
  apiInternalError,
} from '@/lib/api/standardResponse';
import { logger } from '@/utils/logger';

/** Postgres unique_violation — the address is already on the list. */
const UNIQUE_VIOLATION = '23505';

export async function POST(request: NextRequest) {
  try {
    const limit = await rateLimit(request);
    if (!limit.success) {
      return apiRateLimited('Too many requests. Please try again shortly.', retryAfterSeconds(limit));
    }

    const body = await request.json().catch(() => null);
    const parsed = newsletterSubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return apiBadRequest('Please enter a valid email address', parsed.error.issues);
    }

    const { email, source } = parsed.data;
    // looseClient: the table is newer than the generated Database types.
    const { error } = await looseClient(getAdminClient())
      .from(DATABASE_TABLES.NEWSLETTER_SUBSCRIBERS)
      .insert({ email, source });

    if (error && error.code !== UNIQUE_VIOLATION) {
      logger.error(
        'Newsletter subscribe failed',
        { code: error.code, message: error.message, source },
        'Newsletter'
      );
      return apiInternalError('Could not subscribe right now. Please try again.');
    }

    return apiSuccess({ subscribed: true });
  } catch (error) {
    logger.error(
      'Newsletter subscribe crashed',
      { error: error instanceof Error ? error.message : String(error) },
      'Newsletter'
    );
    return apiInternalError('Could not subscribe right now. Please try again.');
  }
}

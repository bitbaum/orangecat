/**
 * POST /api/cat/offers-from-text  — body: { text }
 *
 * The deterministic "paste who you are → get monetizable offerings" seam.
 * Every part of this already existed but only fired reactively inside a chat
 * turn: the onboarding box just seeded a Cat conversation and hoped the model
 * called suggest_offers. This chains the built pieces synchronously —
 * persist the bio, extract the economic profile, and reason over it — so a
 * pasted bio comes back as concrete, typed offers the user can create in one
 * click.
 *
 * Reuses: generateOffers (offer-engine.ts) for the grounded proposals — the
 * pasted text is persisted as the bio AND passed as `focus`, so offers are
 * grounded in it either way. Returns [] on thin input / model failure — the UI
 * degrades to "talk to your Cat instead".
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiSuccess, apiBadRequest, apiRateLimited } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateOffers } from '@/services/cat/offer-engine';
import { logger } from '@/utils/logger';

export const dynamic = 'force-dynamic';

const MAX_TEXT = 4000;

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const { user } = req;

  // Every call triggers an LLM completion — per-user write limit.
  const rl = await rateLimitWriteAsync(user.id);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiBadRequest('Invalid JSON body');
  }

  const rawText = (body as { text?: unknown } | null)?.text;
  const text = typeof rawText === 'string' ? rawText.trim() : '';
  if (!text) {
    return apiBadRequest('text is required');
  }
  const clamped = text.slice(0, MAX_TEXT);

  // Persist the bio so the offer engine's stored-context path (and future
  // sessions) see it. Own-row write through the session client — covered by
  // the profiles_update_own RLS policy. Best-effort: the pasted text is also
  // passed to generateOffers as `focus`, so offers are grounded even if this
  // write fails.
  const { error: bioError } = await req.supabase
    .from(DATABASE_TABLES.PROFILES)
    .update({ bio: clamped, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (bioError) {
    logger.warn(
      'offers-from-text: bio persist failed (non-fatal)',
      { err: bioError },
      'OffersFromText'
    );
  }

  // Admin client kept for offer generation only: generateOffers reads
  // platform-wide demand signals from search_queries (RLS-on, zero policies —
  // service-role is the only reader), so a session client would see nothing.
  const db = createAdminClient();

  try {
    const offers = await generateOffers(db, user.id, { focus: clamped, count: 4 });
    return apiSuccess({ offers });
  } catch (err) {
    logger.error('offers-from-text: generateOffers failed', err, 'OffersFromText');
    // Not a hard error for the user — the UI falls back to opening the Cat chat.
    return apiSuccess({ offers: [] });
  }
});

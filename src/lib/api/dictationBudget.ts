/**
 * Who may dictate, and how much: a signed-in person on their write budget, a
 * visitor with no account on the general per-IP budget and then a dictation
 * budget of its own (owner's call, 2026-11-13; see /api/cat/transcribe).
 */
import type { NextRequest } from 'next/server';
import {
  rateLimit,
  rateLimitDictation,
  rateLimitWriteAsync,
  type RateLimitResult,
} from '@/lib/rate-limit';

// A visitor's take: about four minutes. Enough to say what you need; a long
// recording is what an account is for.
export const MAX_VISITOR_AUDIO_BYTES = 2 * 1024 * 1024;

/** A signed-in person's write budget, or a visitor's IP budgets (both must pass). */
export async function dictationBudget(
  request: NextRequest,
  userId: string | null
): Promise<RateLimitResult> {
  if (userId) {
    return rateLimitWriteAsync(userId);
  }
  const general = await rateLimit(request);
  if (!general.success) {
    return general;
  }
  return rateLimitDictation(request);
}

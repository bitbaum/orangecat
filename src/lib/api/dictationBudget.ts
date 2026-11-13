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

/**
 * A signed-in person's write budget, or a visitor's IP budgets: the general
 * one, then the feature's own (both must pass). One shape for every paid call
 * a visitor may make (dictation, a Studio draft).
 */
export async function visitorOrUserBudget(
  request: NextRequest,
  userId: string | null,
  visitorLimit: (request: NextRequest) => Promise<RateLimitResult>
): Promise<RateLimitResult> {
  if (userId) {
    return rateLimitWriteAsync(userId);
  }
  const general = await rateLimit(request);
  if (!general.success) {
    return general;
  }
  return visitorLimit(request);
}

export function dictationBudget(request: NextRequest, userId: string | null) {
  return visitorOrUserBudget(request, userId, rateLimitDictation);
}

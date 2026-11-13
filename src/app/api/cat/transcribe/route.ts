/**
 * Cat dictation — server-side speech-to-text via Groq Whisper.
 *
 * POST /api/cat/transcribe  (multipart/form-data, field "file" = audio blob)
 * → { success: true, data: { text } }
 *
 * Why server-side: the browser Web Speech API (webkitSpeechRecognition) is
 * disabled by default in Brave (the founder's browser) and inconsistent
 * elsewhere, so in-browser dictation silently failed. Recording with
 * MediaRecorder + transcribing here works in every modern browser and keeps the
 * Groq key server-only.
 *
 * Signed out works too (owner's call, 2026-11-13): "anywhere a person types
 * words there is a microphone" is a fleet rule, and the public boxes (/raise,
 * /feedback, /studio, the door on /what-you-can-do) are where a newcomer meets
 * OrangeCat. A visitor's take is held to a per-IP budget and a shorter
 * recording, the same shape as the public Ask-Cat route.
 *
 * The call itself is @bitbaum/ai-kit's `transcribe` over ai-kit's own speech
 * chain: the fleet's one implementation, with a second model to fall to. It
 * was a hand-rolled fetch at one model, which is the shape ai-kit replaced.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ChainExhaustedError,
  LinkFailure,
  looksLikeSilence,
  speechChain,
  speechConfigured,
  transcribe,
} from '@bitbaum/ai-kit';
import { logger } from '@/utils/logger';
import { apiBadRequest, apiError, apiSuccess, apiInternalError } from '@/lib/api/standardResponse';
import { withOptionalAuth } from '@/lib/api/withAuth';
import {
  applyRateLimitHeaders,
  createRateLimitResponse,
  rateLimit,
  rateLimitDictation,
  rateLimitWriteAsync,
  type RateLimitResult,
} from '@/lib/rate-limit';

/** Per link, so a stalled model costs one budget and not the whole request. */
const LINK_TIMEOUT_MS = 30_000;
// Generous for short dictation; well under Groq's 25 MB limit. A minute of
// opus/webm audio is ~0.5 MB, so 15 MB covers long messages with headroom.
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
// A visitor's take: about four minutes. Enough to say what you need; a long
// recording is what an account is for.
const MAX_VISITOR_AUDIO_BYTES = 2 * 1024 * 1024;

/** A signed-in person's write budget, or a visitor's IP budgets (both must pass). */
async function dictationBudget(
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

export const POST = withOptionalAuth(async request => {
  const userId = request.user?.id ?? null;
  try {
    const rl = await dictationBudget(request, userId);
    if (!rl.success) {
      // createRateLimitResponse returns a bare Response; withAuth wants NextResponse.
      return createRateLimitResponse(rl) as unknown as NextResponse;
    }

    if (!speechConfigured(process.env)) {
      logger.error('Transcribe: GROQ_API_KEY not set', undefined, 'cat/transcribe');
      return apiError('Dictation is not configured right now.', 'TRANSCRIBE_UNAVAILABLE', 503);
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return apiBadRequest('Expected multipart/form-data with an audio file.');
    }

    const file = form.get('file');
    if (!(file instanceof Blob) || file.size === 0) {
      return apiBadRequest('No audio provided.');
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return apiBadRequest('Recording is too long. Keep dictation under ~10 minutes.');
    }
    if (!userId && file.size > MAX_VISITOR_AUDIO_BYTES) {
      return apiBadRequest(
        'Recording is too long. Keep it under about four minutes, or sign in to dictate longer.'
      );
    }

    const optionalLang = form.get('language');
    // Whether any link refused for load: the person is told "busy", not "failed".
    let rateLimited = false;
    let text: string;
    try {
      const result = await transcribe({
        audio: file,
        // Whisper reads the container from the filename; browsers hand us webm.
        filename: 'audio.webm',
        // ai-kit drops a hint Whisper would reject, which fails the whole take.
        language:
          typeof optionalLang === 'string' && optionalLang.length > 0 && optionalLang.length <= 8
            ? optionalLang
            : undefined,
        chain: speechChain(),
        timeoutMs: LINK_TIMEOUT_MS,
        signal: request.signal,
        onLinkFailure: (_link, error) => {
          if (error instanceof LinkFailure && error.status === 429) {
            rateLimited = true;
          }
        },
      });
      // A silent or muted take comes back as Whisper's stock filler ("Thank
      // you.", "Untertitelung des ZDF") and was typed into the person's message.
      // An empty text is chatkit's "Nothing was heard".
      text = looksLikeSilence(result.text) ? '' : result.text.trim();
    } catch (error) {
      // Every link's failure, logged and never returned: a vendor body carries
      // request ids and quota detail that mean nothing to the person.
      const detail =
        error instanceof ChainExhaustedError
          ? error.failures.map(f => f.message).join(' | ')
          : error instanceof Error
            ? error.message
            : String(error);
      logger.error(
        'Transcribe: every link failed',
        { detail: detail.slice(0, 300) },
        'cat/transcribe'
      );
      if (rateLimited) {
        return apiError(
          'Dictation is busy right now — try again in a moment.',
          'AI_RATE_LIMITED',
          429
        );
      }
      return apiError('Could not transcribe that audio. Try again.', 'TRANSCRIBE_FAILED', 502);
    }

    return applyRateLimitHeaders(apiSuccess({ text }), rl);
  } catch (error) {
    logger.error('Transcribe: unhandled error', error, 'cat/transcribe');
    return apiInternalError('Something went wrong transcribing your audio.');
  }
});

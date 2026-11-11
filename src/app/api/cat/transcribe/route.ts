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
 * The call itself is @bitbaum/ai-kit's `transcribe` over services/ai/speech's
 * chain: the fleet's one implementation, with a second model to fall to. It
 * was a hand-rolled fetch at one model, which is the shape ai-kit replaced.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ChainExhaustedError, LinkFailure, transcribe } from '@bitbaum/ai-kit';
import { speechChain, speechConfigured } from '@/services/ai/speech';
import { logger } from '@/utils/logger';
import { apiBadRequest, apiError, apiSuccess, apiInternalError } from '@/lib/api/standardResponse';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  applyRateLimitHeaders,
  createRateLimitResponse,
  rateLimitWriteAsync,
} from '@/lib/rate-limit';

/** Per link, so a stalled model costs one budget and not the whole request. */
const LINK_TIMEOUT_MS = 30_000;
// Generous for short dictation; well under Groq's 25 MB limit. A minute of
// opus/webm audio is ~0.5 MB, so 15 MB covers long messages with headroom.
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { user } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      // createRateLimitResponse returns a bare Response; withAuth wants NextResponse.
      return createRateLimitResponse(rl) as unknown as NextResponse;
    }

    if (!speechConfigured()) {
      logger.error('Transcribe: GROQ_API_KEY not set', undefined, 'cat/transcribe');
      return apiError('Dictation is not configured right now.', 'TRANSCRIBE_UNAVAILABLE', 503);
    }

    let form: FormData;
    try {
      form = await (request as NextRequest).formData();
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
        signal: (request as NextRequest).signal,
        onLinkFailure: (_link, error) => {
          if (error instanceof LinkFailure && error.status === 429) {
            rateLimited = true;
          }
        },
      });
      text = result.text.trim();
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

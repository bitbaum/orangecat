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
 * Groq key server-only. Model: whisper-large-v3-turbo (fast + cheap + accurate).
 */

import { NextRequest, NextResponse } from 'next/server';
import { PROVIDER_BASE_URLS } from '@/config/ai-provider-runtime';
import { logger } from '@/utils/logger';
import { apiBadRequest, apiError, apiSuccess, apiInternalError } from '@/lib/api/standardResponse';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  applyRateLimitHeaders,
  createRateLimitResponse,
  rateLimitWriteAsync,
} from '@/lib/rate-limit';
import { sanitizeApiKey } from '@/lib/api-key';

const GROQ_TRANSCRIBE_URL = `${PROVIDER_BASE_URLS.groq}/audio/transcriptions`;
const GROQ_WHISPER_MODEL = 'whisper-large-v3-turbo';
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

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
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

    // Forward to Groq's OpenAI-compatible transcription endpoint.
    const groqForm = new FormData();
    groqForm.append('file', file, 'audio.webm');
    groqForm.append('model', GROQ_WHISPER_MODEL);
    groqForm.append('response_format', 'json');
    const optionalLang = form.get('language');
    if (typeof optionalLang === 'string' && optionalLang.length > 0 && optionalLang.length <= 8) {
      groqForm.append('language', optionalLang);
    }

    const res = await fetch(GROQ_TRANSCRIBE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sanitizeApiKey(apiKey)}` },
      body: groqForm,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      logger.error(
        'Transcribe: Groq error',
        { status: res.status, detail: detail.slice(0, 300) },
        'cat/transcribe'
      );
      if (res.status === 429) {
        return apiError(
          'Dictation is busy right now — try again in a moment.',
          'AI_RATE_LIMITED',
          429
        );
      }
      return apiError('Could not transcribe that audio. Try again.', 'TRANSCRIBE_FAILED', 502);
    }

    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? '').trim();

    return applyRateLimitHeaders(apiSuccess({ text }), rl);
  } catch (error) {
    logger.error('Transcribe: unhandled error', error, 'cat/transcribe');
    return apiInternalError('Something went wrong transcribing your audio.');
  }
});

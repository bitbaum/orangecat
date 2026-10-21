import type { NextResponse } from 'next/server';
import { SITE_URL } from '@/config/brand';
import { withAuth } from '@/lib/api/withAuth';
import { apiBadRequest, apiError, apiSuccess } from '@/lib/api/standardResponse';
import { createRateLimitResponse, rateLimitWriteAsync } from '@/lib/rate-limit';
import {
  creativeBriefSchema,
  creativeDraftSchema,
  creativeSystemPrompt,
} from '@/domain/creative/brief';
import { callPlatformJson, parseJsonLoose } from '@/services/cat/platform-llm';

export const POST = withAuth(async request => {
  const origin = request.headers.get('origin');
  if (origin !== request.nextUrl.origin && origin !== new URL(SITE_URL).origin) {
    return apiError('Open the Studio on OrangeCat to create a draft.', 'INVALID_ORIGIN', 403);
  }
  const limit = await rateLimitWriteAsync(request.user.id);
  if (!limit.success) {
    return createRateLimitResponse(limit) as NextResponse;
  }
  // Read at most 64 KB even for chunked requests, before parsing JSON.
  const reader = request.body?.getReader();
  if (!reader) {
    return apiBadRequest('A creative brief is required.');
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    length += value.byteLength;
    if (length > 65536) {
      await reader.cancel();
      return apiError('That brief is too long.', 'TOO_LARGE', 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return apiBadRequest('Invalid creative brief.');
  }
  const brief = creativeBriefSchema.safeParse(body);
  if (!brief.success) {
    return apiBadRequest('Describe a feeling and choose a form.', brief.error.flatten());
  }
  const raw = await callPlatformJson(
    creativeSystemPrompt(brief.data.form),
    JSON.stringify(brief.data),
    {
      maxTokens: 2600,
      temperature: 0.85,
      timeoutMs: 45000,
    }
  );
  const draft = creativeDraftSchema.safeParse(parseJsonLoose(raw));
  if (!draft.success || (brief.data.form === 'music' && !draft.data.score)) {
    return apiError(
      'The artist could not finish this draft. Your brief is still here; try again.',
      'AI_UNAVAILABLE',
      503
    );
  }
  // Scores belong only to music; other media never trigger audio playback.
  if (brief.data.form !== 'music') {
    delete draft.data.score;
  }
  return apiSuccess(draft.data);
});

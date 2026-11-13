import type { NextResponse } from 'next/server';
import { SITE_URL } from '@/config/brand';
import { withOptionalAuth } from '@/lib/api/withAuth';
import { visitorOrUserBudget } from '@/lib/api/dictationBudget';
import { apiBadRequest, apiError, apiSuccess } from '@/lib/api/standardResponse';
import { createRateLimitResponse, rateLimitStudio } from '@/lib/rate-limit';
import {
  creativeBriefSchema,
  creativeSystemPrompt,
  readCreativeDraft,
} from '@/domain/creative/brief';
import { callPlatformJson, parseJsonLoose } from '@/services/cat/platform-llm';

// Visitors may draft too (owner's call, 2026-11-13): the Studio is a public
// page, and a sign-in wall in a new tab was where every first try ended. A
// visitor's draft is held to a per-IP budget, like dictation and Ask-Cat.
export const POST = withOptionalAuth(async request => {
  const origin = request.headers.get('origin');
  if (origin !== request.nextUrl.origin && origin !== new URL(SITE_URL).origin) {
    return apiError('Open the Studio on OrangeCat to create a draft.', 'INVALID_ORIGIN', 403);
  }
  const limit = await visitorOrUserBudget(request, request.user?.id ?? null, rateLimitStudio);
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
  const system = creativeSystemPrompt(brief.data.form);
  const userMessage = JSON.stringify(brief.data);
  const draw = async () =>
    readCreativeDraft(
      parseJsonLoose(
        await callPlatformJson(system, userMessage, {
          maxTokens: 2600,
          temperature: 0.85,
          timeoutMs: 45000,
        })
      ),
      brief.data.form
    );
  // One more try before giving up: a free model's draft is sometimes unusable
  // JSON, and the person should not have to press the button again for that.
  const draft = (await draw()) ?? (await draw());
  if (!draft) {
    return apiError(
      'The artist could not finish this draft. Your brief is still here; try again.',
      'AI_UNAVAILABLE',
      503
    );
  }
  return apiSuccess(draft);
});

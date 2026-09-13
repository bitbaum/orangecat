/**
 * One entry point for "make me this", whatever the medium.
 *
 * The route stays thin: it validates, calls this, and maps the discriminated
 * result onto a response. Video and music start a job the browser polls; images
 * and writing come back in the same request because they are fast enough to.
 *
 * Created: 2026-09-13
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { StudioMedium } from '@/config/studio';
import { generateImageWithKey } from '@/services/images/generate';
import { resolveImageKey, resolveMediaKey } from './access';
import { draftStudioWriting } from './generate-writing';
import { startJob } from './media-jobs';
import { persistStudioMedia } from './persist';

export type GenerateOutcome =
  /** A render is under way; the browser polls with this id. */
  | { kind: 'job'; jobId: string; provider: string; model: string }
  /** Finished in-request: a stored file the page can show immediately. */
  | { kind: 'file'; url: string; provider: string; model: string }
  /** Finished in-request: text the page shows in the editor. */
  | { kind: 'text'; title: string; text: string }
  /** The user cannot make this yet — the message says what would fix it. */
  | { kind: 'needs_key'; message: string }
  /** Everything else, already phrased for a person. */
  | { kind: 'error'; message: string };

const NO_KEY_MESSAGE: Record<'video' | 'music' | 'image', string> = {
  video: 'Video rendering uses your own AI key. Add a Replicate or OpenAI key in Settings → AI.',
  music: 'Music uses your own AI key. Add a Replicate key in Settings → AI.',
  image: 'Image generation uses your own AI key. Add one in Settings → AI.',
};

export async function startStudioGeneration(
  supabase: AnySupabaseClient,
  userId: string,
  medium: StudioMedium,
  prompt: string
): Promise<GenerateOutcome> {
  if (medium === 'writing') {
    const draft = await draftStudioWriting(prompt);
    return draft
      ? { kind: 'text', title: draft.title, text: draft.text }
      : {
          kind: 'error',
          message: 'The writer is busy right now. Try again in a moment.',
        };
  }

  if (medium === 'image') {
    const key = await resolveImageKey(supabase, userId);
    if (!key) {
      return { kind: 'needs_key', message: NO_KEY_MESSAGE.image };
    }
    const result = await generateImageWithKey({
      apiKey: key.apiKey,
      baseUrl: key.baseUrl,
      model: key.defaultImageModel,
      prompt,
      api: key.api,
    });
    if (!result.ok) {
      return { kind: 'error', message: `Image generation failed: ${result.error}` };
    }
    const stored = await persistStudioMedia(userId, result.image);
    return stored.ok
      ? { kind: 'file', url: stored.url, provider: key.providerId, model: key.defaultImageModel }
      : { kind: 'error', message: stored.error };
  }

  const key = await resolveMediaKey(supabase, userId, medium);
  if (!key) {
    return { kind: 'needs_key', message: NO_KEY_MESSAGE[medium] };
  }

  const started = await startJob(
    {
      apiKey: key.apiKey,
      baseUrl: key.baseUrl,
      model: key.model,
      api: key.api,
      providerId: key.providerId,
      medium,
    },
    prompt
  );

  return started.ok
    ? { kind: 'job', jobId: started.jobId, provider: key.providerId, model: key.model }
    : { kind: 'error', message: `Could not start the render: ${started.error}` };
}

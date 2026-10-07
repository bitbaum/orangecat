/**
 * Generate an image with the person's OWN key and keep a stable public copy.
 *
 * One path for everything that generates: the picker's API route and the Cat
 * (an event's cover). BYOK-only, exactly as the route always was — the
 * platform's free pool never pays for pixels.
 */

import { createApiKeyService } from '@/services/ai/api-key-service';
import { IMAGE_PROVIDER_RUNTIME, getImageProviderRuntime } from '@/config/ai-provider-runtime';
import { generateImageWithKey } from '@/services/images/generate';
import { IMAGE_MIME_EXT } from '@/services/images/types';
import { getAdminClient } from '@/lib/supabase/admin';
import { STORAGE_BUCKETS } from '@/config/database-tables';
import { logger } from '@/utils/logger';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export type GenerateAndStoreResult =
  | { ok: true; url: string; provider: string; model: string }
  | { ok: false; code: 'NO_IMAGE_KEY' | 'NOT_CONFIGURED' | 'UPSTREAM' | 'STORE'; error: string };

/** Said wherever a person without an image-capable key asks for one. */
export const NO_IMAGE_KEY_MESSAGE =
  'Image generation uses your own AI key. Add one in Settings → AI.';

export async function generateAndStoreImage(
  supabase: AnySupabaseClient,
  userId: string,
  prompt: string
): Promise<GenerateAndStoreResult> {
  // First image-capable key in the user's own fallback-chain order.
  const keys = await createApiKeyService(supabase).listDecryptedKeysOrdered(userId);
  const imageKey = keys.find(k => k.provider in IMAGE_PROVIDER_RUNTIME);
  if (!imageKey) {
    return { ok: false, code: 'NO_IMAGE_KEY', error: NO_IMAGE_KEY_MESSAGE };
  }
  const runtime = getImageProviderRuntime(imageKey.provider);
  if (!runtime) {
    return { ok: false, code: 'NOT_CONFIGURED', error: 'Image provider is not configured.' };
  }

  const result = await generateImageWithKey({
    apiKey: imageKey.key,
    baseUrl: runtime.baseUrl,
    model: runtime.defaultImageModel,
    prompt,
    api: runtime.api,
  });
  if (!result.ok) {
    return { ok: false, code: 'UPSTREAM', error: `Image generation failed: ${result.error}` };
  }

  // Persist a stable copy — provider URLs/base64 are ephemeral. The admin
  // client bypasses RLS, so the path MUST be scoped to the user's own folder
  // (the browser cover-upload convention).
  const ext = IMAGE_MIME_EXT[result.image.mimeType] ?? 'png';
  const path = `${userId}/ai-gen_${Date.now()}.${ext}`;
  const admin = getAdminClient();
  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKETS.BANNERS)
    .upload(path, result.image.bytes, {
      contentType: result.image.mimeType,
      cacheControl: '31536000',
      upsert: false,
    });
  if (uploadError) {
    logger.error('Generated image upload failed', { error: uploadError }, 'ImagesAPI');
    return {
      ok: false,
      code: 'STORE',
      error: 'Could not save the generated image. Please try again.',
    };
  }
  const { data } = admin.storage.from(STORAGE_BUCKETS.BANNERS).getPublicUrl(path);
  return {
    ok: true,
    url: data.publicUrl,
    provider: imageKey.provider,
    model: runtime.defaultImageModel,
  };
}

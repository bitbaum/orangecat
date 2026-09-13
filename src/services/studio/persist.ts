/**
 * Persist a finished Studio render to storage and hand back a stable URL.
 *
 * Provider URLs expire — Replicate's signed links are short-lived and OpenAI's
 * content endpoint needs the key. A creation that vanishes an hour after it is
 * made cannot be sold or funded, so the bytes are copied here the moment the
 * job reports ready.
 *
 * Created: 2026-09-13
 */

import { getAdminClient } from '@/lib/supabase/admin';
import { STORAGE_BUCKETS } from '@/config/database-tables';
import { STUDIO_STORAGE_PREFIX } from '@/config/studio';
import { STUDIO_MIME_EXT } from './media-jobs';
import { logger } from '@/utils/logger';
import type { GeneratedMedia } from './types';

export type PersistResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * The admin client bypasses RLS, so the path MUST be scoped to the
 * authenticated user id — the same convention the image route and the browser
 * cover-upload path follow.
 */
export async function persistStudioMedia(
  userId: string,
  media: GeneratedMedia
): Promise<PersistResult> {
  const ext = STUDIO_MIME_EXT[media.mimeType] ?? 'bin';
  const path = `${userId}/${STUDIO_STORAGE_PREFIX}/${Date.now()}.${ext}`;
  const admin = getAdminClient();

  const { error } = await admin.storage
    .from(STORAGE_BUCKETS.PROJECT_MEDIA)
    .upload(path, media.bytes, {
      contentType: media.mimeType,
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) {
    logger.error('Studio media upload failed', { error }, 'Studio');
    return { ok: false, error: 'Could not save the finished file. Please try again.' };
  }

  const { data } = admin.storage.from(STORAGE_BUCKETS.PROJECT_MEDIA).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

/**
 * Where a photo attached in the Cat chat lives after the turn.
 *
 * PRIVATE (`documents` bucket, `<user-id>/cat/<uuid>.<ext>`): a chat photo is
 * often a screenshot the person never meant to publish, so it is served only
 * to its owner, through /api/cat/attachments. It becomes public only when it
 * is PUT on something public — `publishChatImage` copies it to the public
 * bucket when the Cat drafts a listing from it.
 *
 * Before this, the pixels reached the model and went nowhere: the thread
 * showed a file name and the Cat could not put the photo on the product it
 * had just drafted from it.
 */

import { randomUUID } from 'crypto';
import { getAdminClient } from '@/lib/supabase/admin';
import { STORAGE_BUCKETS } from '@/config/database-tables';
import { logger } from '@/utils/logger';
import type { ChatImage } from './chat-images';

const PRIVATE_BUCKET = STORAGE_BUCKETS.DOCUMENTS;
const PUBLIC_BUCKET = STORAGE_BUCKETS.BANNERS;
const DATA_URL = /^data:(image\/(png|jpeg|webp|gif));base64,(.+)$/;
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** A path is the owner's when its first segment is their id — nothing else. */
export function isOwnChatImagePath(path: string, userId: string): boolean {
  return (
    path.startsWith(`${userId}/cat/`) &&
    !path.includes('..') &&
    /^[\w-]+\/cat\/[\w-]+\.\w+$/.test(path)
  );
}

/**
 * Store each photo; returns its private path, or null where storing failed.
 * A failure never fails the turn — the model already has the pixels.
 */
export async function storeChatImages(
  userId: string,
  images: ChatImage[]
): Promise<Array<string | null>> {
  const admin = getAdminClient();
  return Promise.all(
    images.map(async img => {
      const m = DATA_URL.exec(img.dataUrl);
      if (!m) {
        return null;
      }
      const path = `${userId}/cat/${randomUUID()}.${EXT[m[1]]}`;
      const { error } = await admin.storage
        .from(PRIVATE_BUCKET)
        .upload(path, Buffer.from(m[3], 'base64'), { contentType: m[1], upsert: false });
      if (error) {
        logger.warn('Cat chat: could not store a photo', { error: error.message }, 'cat/chat');
        return null;
      }
      return path;
    })
  );
}

/** A short-lived URL for the owner to view a stored photo. */
export async function signedChatImageUrl(path: string): Promise<string | null> {
  const { data, error } = await getAdminClient()
    .storage.from(PRIVATE_BUCKET)
    .createSignedUrl(path, 60 * 10);
  return error ? null : data.signedUrl;
}

/**
 * Copy a private chat photo to the public bucket and return its public URL —
 * for a listing drafted from it. Same owner folder, so existing public-image
 * conventions (and cleanup by owner) hold.
 */
export async function publishChatImage(path: string, userId: string): Promise<string | null> {
  if (!isOwnChatImagePath(path, userId)) {
    return null;
  }
  const admin = getAdminClient();
  const { data: blob, error } = await admin.storage.from(PRIVATE_BUCKET).download(path);
  if (error || !blob) {
    return null;
  }
  const target = `${userId}/listing_${path.split('/').pop()}`;
  const { error: upErr } = await admin.storage
    .from(PUBLIC_BUCKET)
    .upload(target, blob, { contentType: blob.type || undefined, upsert: true });
  if (upErr) {
    logger.warn('Cat chat: could not publish a photo', { error: upErr.message }, 'cat/chat');
    return null;
  }
  return admin.storage.from(PUBLIC_BUCKET).getPublicUrl(target).data.publicUrl;
}

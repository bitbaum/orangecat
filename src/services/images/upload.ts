/**
 * Generic user-image upload to the public BANNERS bucket under `${userId}/…`
 * — the same convention avatars/banners/article covers already use, so no new
 * bucket or policy. Shared by article covers and the post-image Upload tab.
 *
 * Oversized photos are NOT rejected: anything over the bucket's server-side
 * limit is downscaled/re-encoded client-side first, so a 40MB phone photo
 * just works. The only hard failure is an animated GIF too large to keep
 * (resizing would destroy the animation).
 */

import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { STORAGE_BUCKETS } from '@/config/database-tables';
import type { FileUploadResult } from '@/types/storage';

const BUCKET = STORAGE_BUCKETS.BANNERS;
// The banners bucket's server-side file_size_limit — uploads above this fail
// at the bucket with a cryptic error, so we shrink to fit before sending.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// Long-edge cap when re-encoding. Feed/cover rendering never needs more.
const MAX_DIMENSION = 2048;
// Quality ladder: try better quality first, step down until it fits.
const ENCODINGS: Array<{ type: string; quality: number }> = [
  { type: 'image/webp', quality: 0.85 },
  { type: 'image/webp', quality: 0.7 },
  { type: 'image/jpeg', quality: 0.8 },
  { type: 'image/jpeg', quality: 0.6 },
];

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
/** Human rendering of ALLOWED_TYPES — keep the two in sync. */
export const IMAGE_UPLOAD_FORMATS_LABEL = 'JPEG, PNG, WebP, or GIF';

export const IMAGE_UPLOAD_ACCEPT = ALLOWED_TYPES.join(',');
export const IMAGE_UPLOAD_MAX_MB = MAX_UPLOAD_BYTES / 1024 / 1024;

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: `Please choose a ${IMAGE_UPLOAD_FORMATS_LABEL} image.` };
  }
  return { valid: true };
}

/**
 * Downscale + re-encode until the result fits. Defaults to the bucket's limits;
 * the Cat chat passes its own (a photo for a model, not for a cover).
 */
export async function shrinkToFit(
  file: File,
  { maxDimension = MAX_DIMENSION, maxBytes = MAX_UPLOAD_BYTES } = {}
): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    // White under transparency — JPEG has no alpha and would render black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    for (const { type, quality } of ENCODINGS) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
      // Some browsers silently fall back to PNG for unsupported types — the
      // type check filters that out so the ladder keeps stepping down.
      if (blob && blob.type === type && blob.size <= maxBytes) {
        return blob;
      }
    }
    return null;
  } catch (err) {
    logger.warn('Client-side image shrink failed', { error: String(err) }, 'Images');
    return null;
  }
}

export async function uploadUserImage(
  userId: string,
  file: File,
  prefix: string
): Promise<FileUploadResult> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  let payload: Blob = file;
  let contentType = file.type;

  if (file.size > MAX_UPLOAD_BYTES) {
    if (file.type === 'image/gif') {
      return {
        success: false,
        error: `That GIF is over ${IMAGE_UPLOAD_MAX_MB}MB and resizing would break the animation — please pick a smaller one.`,
      };
    }
    const shrunk = await shrinkToFit(file);
    if (!shrunk) {
      return {
        success: false,
        error: 'Could not resize that image in your browser. Please try a smaller file.',
      };
    }
    payload = shrunk;
    contentType = shrunk.type;
  }

  try {
    const ext = EXT_BY_TYPE[contentType] ?? 'jpg';
    // userId first segment namespaces each user's uploads (same convention as
    // avatars/banners). Timestamp keeps successive uploads from colliding.
    const fileName = `${userId}/${prefix}_${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(fileName, payload, {
      contentType,
      cacheControl: '31536000',
      upsert: true,
    });
    if (error) {
      logger.error('Failed to upload image', { error: error.message, prefix }, 'Images');
      return { success: false, error: error.message || 'Upload failed. Please try again.' };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return { success: true, url: publicUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed. Please try again.';
    logger.error('Error uploading image', { message, prefix }, 'Images');
    return { success: false, error: message };
  }
}

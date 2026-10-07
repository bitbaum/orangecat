/**
 * Profile Storage Service
 * Handles profile media uploads (avatars, banners) to Supabase storage
 *
 * Created: 2025-10-13
 * Last Modified: 2025-10-13
 * Last Modified Summary: Created to handle profile image uploads
 */

import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { STORAGE_BUCKETS } from '@/config/database-tables';
import type { FileUploadResult, FileUploadProgress } from '@/types/storage';
import type { ServiceResult } from '@/types/common';
import { prepareImageForUpload } from '@/services/images/upload';

export type { FileUploadResult, FileUploadProgress };

export class ProfileStorageService {
  private static readonly AVATAR_BUCKET = STORAGE_BUCKETS.AVATARS;
  private static readonly BANNER_BUCKET = STORAGE_BUCKETS.BANNERS;
  // Both buckets' server-side file_size_limit. Bigger photos are shrunk to fit.
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024;

  /**
   * Upload profile avatar image
   */
  static async uploadAvatar(
    userId: string,
    file: File,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> {
    return this.uploadFile(file, this.AVATAR_BUCKET, `${userId}/avatar`, 'avatar', onProgress);
  }

  /**
   * Upload profile banner image
   */
  static async uploadBanner(
    userId: string,
    file: File,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> {
    return this.uploadFile(file, this.BANNER_BUCKET, `${userId}/banner`, 'banner', onProgress);
  }

  /**
   * Generic file upload method
   */
  private static async uploadFile(
    file: File,
    bucketName: string,
    path: string,
    type: string,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> {
    try {
      const prepared = await prepareImageForUpload(file, { maxBytes: this.MAX_FILE_SIZE });
      if (!prepared.ok) {
        return { success: false, error: prepared.error };
      }
      const { payload, contentType, ext } = prepared;
      const fileName = `${path}_${Date.now()}.${ext}`;

      // Simulate progress for small files
      if (onProgress) {
        const simulateProgress = () => {
          let progress = 0;
          const interval = setInterval(() => {
            progress += 20;
            onProgress({
              loaded: (progress / 100) * payload.size,
              total: payload.size,
              percentage: Math.min(progress, 90),
            });
            if (progress >= 90) {
              clearInterval(interval);
            }
          }, 100);
        };
        simulateProgress();
      }

      // Upload to Supabase Storage
      const { data: _data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, payload, {
          contentType,
          cacheControl: '31536000', // 1 year
          upsert: true, // Replace if exists
        });

      if (error) {
        logger.error(`Failed to upload ${type}`, { error, fileName });
        return {
          success: false,
          error: error.message || `Failed to upload ${type}`,
        };
      }

      // Complete progress
      if (onProgress) {
        onProgress({
          loaded: payload.size,
          total: payload.size,
          percentage: 100,
        });
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucketName).getPublicUrl(fileName);

      logger.info(`Successfully uploaded ${type}`, { fileName, url: publicUrl });

      return {
        success: true,
        url: publicUrl,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error uploading ${type}`, { error: message });
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Delete a file from storage
   */
  static async deleteFile(
    filePath: string,
    bucketName: string = ProfileStorageService.AVATAR_BUCKET
  ): Promise<ServiceResult> {
    try {
      const { error } = await supabase.storage.from(bucketName).remove([filePath]);

      if (error) {
        logger.error('Failed to delete file', { error, filePath });
        return {
          success: false,
          error: error.message,
        };
      }

      logger.info('Successfully deleted file', { filePath });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error deleting file', { error: message, filePath });
      return {
        success: false,
        error: message,
      };
    }
  }
}

export default ProfileStorageService;

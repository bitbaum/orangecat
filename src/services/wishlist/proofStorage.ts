/**
 * Proof Storage Service
 * Handles proof image uploads (receipts, screenshots) to Supabase storage
 *
 * Created: 2026-01-09
 * Last Modified: 2026-01-09
 * Last Modified Summary: Created to handle wishlist proof image uploads
 */

import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { STORAGE_BUCKETS } from '@/config/database-tables';
import type { FileUploadResult, FileUploadProgress } from '@/types/storage';
import type { ServiceResult } from '@/types/common';
import { prepareImageForUpload } from '@/services/images/upload';

export type { FileUploadResult, FileUploadProgress };

export class ProofStorageService {
  private static readonly BUCKET_NAME = STORAGE_BUCKETS.PROOFS;
  // The proofs bucket's limit. Bigger photos are shrunk to fit, not refused.
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

  /**
   * Upload proof image (receipt or screenshot)
   * @param wishlistItemId - The wishlist item this proof belongs to
   * @param file - The image file to upload
   * @param proofType - Type of proof (receipt, screenshot)
   * @param onProgress - Optional progress callback
   */
  static async uploadProofImage(
    wishlistItemId: string,
    file: File,
    proofType: 'receipt' | 'screenshot',
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> {
    return this.uploadFile(file, `${wishlistItemId}/${proofType}`, proofType, onProgress);
  }

  /**
   * Generic file upload method
   */
  private static async uploadFile(
    file: File,
    path: string,
    type: string,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> {
    try {
      if (!file) {
        return { success: false, error: 'No file provided' };
      }
      const prepared = await prepareImageForUpload(file, { maxBytes: this.MAX_FILE_SIZE });
      if (!prepared.ok) {
        return { success: false, error: prepared.error };
      }
      const { payload, contentType, ext } = prepared;
      // Timestamp keeps successive proofs from colliding.
      const fileName = `${path}_${Date.now()}.${ext}`;

      // Start progress simulation for UX feedback
      let progressInterval: NodeJS.Timeout | null = null;
      if (onProgress) {
        let progress = 0;
        progressInterval = setInterval(() => {
          progress += 15;
          onProgress({
            loaded: (progress / 100) * payload.size,
            total: payload.size,
            percentage: Math.min(progress, 85),
          });
          if (progress >= 85 && progressInterval) {
            clearInterval(progressInterval);
          }
        }, 100);
      }

      // Upload to Supabase Storage
      const { error } = await supabase.storage.from(this.BUCKET_NAME).upload(fileName, payload, {
        contentType,
        cacheControl: '31536000', // 1 year cache
        upsert: false, // Don't overwrite - each proof is unique
      });

      // Clear progress interval
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      if (error) {
        logger.error(`Failed to upload proof ${type}`, { error, fileName });
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
      } = supabase.storage.from(this.BUCKET_NAME).getPublicUrl(fileName);

      logger.info(`Successfully uploaded proof ${type}`, {
        fileName,
        url: publicUrl,
      });

      return {
        success: true,
        url: publicUrl,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error uploading proof ${type}`, { error: message });
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Delete a proof file from storage
   */
  static async deleteFile(filePath: string): Promise<ServiceResult> {
    try {
      const { error } = await supabase.storage.from(this.BUCKET_NAME).remove([filePath]);

      if (error) {
        logger.error('Failed to delete proof file', { error, filePath });
        return {
          success: false,
          error: error.message,
        };
      }

      logger.info('Successfully deleted proof file', { filePath });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error deleting proof file', { error: message, filePath });
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Extract file path from public URL for deletion
   */
  static extractFilePathFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/storage/v1/object/public/proofs/');
      return pathParts.length > 1 ? pathParts[1] : null;
    } catch {
      return null;
    }
  }
}

export default ProofStorageService;

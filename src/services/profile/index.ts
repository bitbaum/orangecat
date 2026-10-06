/**
 * PROFILE SERVICE - MODULAR ARCHITECTURE
 *
 * Created: 2025-01-09
 * Last Modified: 2025-01-09
 * Last Modified Summary: ✅ REFACTORED from 808-line monolith to modular architecture - Option A Phase 1 Complete
 *
 * BEFORE: 808 lines in single file (102% over 400-line limit)
 * AFTER: 6 focused modules with single responsibilities
 *
 * Architecture Benefits:
 * - Single Responsibility Principle
 * - Better testability
 * - Easier maintenance
 * - Improved code reuse
 * - Clear separation of concerns
 */

// Main service class that combines all operations
import supabase from '@/lib/supabase/browser';
import { ProfileReader } from './reader';
import { ProfileWriter } from './writer';
import type { ScalableProfile, ScalableProfileFormData, ProfileServiceResponse } from './types';
import type { ServiceResult } from '@/types/common';

export class ProfileService {
  // =====================================================================
  // 📖 READ OPERATIONS
  // =====================================================================

  static async getProfile(userId: string): Promise<ScalableProfile | null> {
    return ProfileReader.getProfile(userId);
  }

  static async getProfiles(
    options: {
      limit?: number;
      offset?: number;
      orderBy?: string;
      orderDirection?: 'asc' | 'desc';
    } = {}
  ): Promise<ScalableProfile[]> {
    return ProfileReader.getProfiles(options);
  }

  static async searchProfiles(
    searchTerm: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<ScalableProfile[]> {
    return ProfileReader.searchProfiles(searchTerm, limit, offset);
  }

  static async getAllProfiles(): Promise<ScalableProfile[]> {
    return ProfileReader.getAllProfiles();
  }

  static async incrementProfileViews(userId: string): Promise<void> {
    return ProfileReader.incrementProfileViews(userId);
  }

  // =====================================================================
  // ✏️ WRITE OPERATIONS
  // =====================================================================

  static async updateProfile(
    userId: string,
    formData: ScalableProfileFormData
  ): Promise<ProfileServiceResponse<ScalableProfile>> {
    return ProfileWriter.updateProfile(userId, formData);
  }

  static async createProfile(
    userId: string,
    formData: ScalableProfileFormData
  ): Promise<ProfileServiceResponse<ScalableProfile>> {
    return ProfileWriter.createProfile(userId, formData);
  }

  static async deleteProfile(userId: string): Promise<ProfileServiceResponse<void>> {
    return ProfileWriter.deleteProfile(userId);
  }

  static async fallbackProfileUpdate(
    userId: string,
    updates: Record<string, unknown>
  ): Promise<ProfileServiceResponse<unknown>> {
    return ProfileWriter.fallbackUpdate(userId, updates);
  }

  // =====================================================================
  // 🔐 LEGACY COMPATIBILITY METHODS
  // =====================================================================

  static async updatePassword(newPassword: string): Promise<ServiceResult> {
    try {
      const result = await supabase.auth.updateUser({ password: newPassword });

      if (result && result.error) {
        return { success: false, error: result.error.message || String(result.error) };
      }

      return { success: true };
    } catch (err) {
      // Network/authentication or other runtime errors
      const message = (err as Error)?.message || 'Unexpected error';
      return { success: false, error: message };
    }
  }
}

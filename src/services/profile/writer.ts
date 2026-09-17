/**
 * PROFILE WRITER MODULE
 *
 * Created: 2025-01-09
 * Last Modified: 2025-10-23
 * Last Modified Summary: Enhanced with username uniqueness check and proper error handling
 */

import { fromTable } from '@/lib/supabase/untyped';
import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { ProfileMapper } from './mapper';
import type { ScalableProfile, ScalableProfileFormData, ProfileServiceResponse } from './types';
import { DATABASE_TABLES, OWN_PROFILE_VIEW } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';

// =====================================================================
// ✏️ PROFILE WRITE OPERATIONS
// =====================================================================

export class ProfileWriter {
  /**
   * Check if username is available (not taken by another user)
   */
  static async checkUsernameUniqueness(username: string, currentUserId: string): Promise<boolean> {
    if (!username?.trim()) {
      return true; // Empty username is always "available" (will be handled by validation)
    }

    try {
      const { data } = await supabase
        .from(DATABASE_TABLES.PROFILES)
        .select('id')
        .eq('username', username.trim())
        .neq('id', currentUserId)
        .single();

      return !data; // true if no other user has this username
    } catch (error) {
      logger.error('ProfileWriter.checkUsernameUniqueness error:', error);
      return false; // Err on the side of caution
    }
  }

  /**
   * Update profile with comprehensive field support
   * Includes username uniqueness check and proper error handling
   */
  static async updateProfile(
    userId: string,
    formData: ScalableProfileFormData
  ): Promise<ProfileServiceResponse<ScalableProfile>> {
    if (!userId?.trim()) {
      return { success: false, error: 'User ID is required' };
    }

    try {
      logger.info('[Profile] updateProfile', { userId, formData });

      // Check username uniqueness if username is being updated
      if (formData.username) {
        const isAvailable = await this.checkUsernameUniqueness(formData.username, userId);

        if (!isAvailable) {
          return {
            success: false,
            error: 'Username is already taken',
          };
        }
      }

      // Prepare update data
      const updateData = {
        ...formData,
        updated_at: new Date().toISOString(),
      };

      // Update in database

      // Persist to the TABLE (RLS `profiles_update_own` confines this to the
      // caller's own row), but do not ask for the row back in the same
      // statement: `.select('*')` is `RETURNING *`, which needs SELECT on every
      // column returned, and `authenticated` holds none on email / phone /
      // contact_email (20260917163100). The read-back goes through the
      // owner-scoped view, so the returned profile is unchanged.
      const { error } = await fromTable(supabase, DATABASE_TABLES.PROFILES)
        .update(updateData)
        .eq('id', userId);

      const { data } = error
        ? { data: null }
        : await fromTable(supabase, OWN_PROFILE_VIEW).select('*').single();

      if (error) {
        logger.error('ProfileWriter.updateProfile database error:', error);

        // Handle specific errors
        if (error.code === '23505') {
          return { success: false, error: 'Username is already taken' };
        }

        return {
          success: false,
          error: 'Failed to update profile. Please try again.',
        };
      }

      const updatedProfile = ProfileMapper.mapDatabaseToProfile(data);
      logger.info('[Profile] updateProfile success', { userId, profile: updatedProfile });

      return { success: true, data: updatedProfile ?? undefined };
    } catch (err) {
      logger.error('ProfileWriter.updateProfile unexpected error:', err);
      return {
        success: false,
        error:
          'An unexpected error occurred while updating profile. Please check your connection and try again.',
      };
    }
  }

  /**
   * Create a new profile
   */
  static async createProfile(
    userId: string,
    formData: ScalableProfileFormData
  ): Promise<ProfileServiceResponse<ScalableProfile>> {
    if (!userId?.trim()) {
      return { success: false, error: 'User ID is required' };
    }

    try {
      logger.info('[Profile] createProfile', { userId, formData });

      // Prepare profile data
      const profileData: Partial<ScalableProfile> = {
        id: userId,
        ...formData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
        status: STATUS.PROFILES.ACTIVE,
        onboarding_completed: false,
      };

      // Map to database format
      const insertData = ProfileMapper.mapProfileToDatabase(profileData);
      insertData.id = userId; // Ensure ID is set

      // Insert without RETURNING, then read the row back through the
      // owner-scoped view — see updateProfile above for why.
      const { error } = await supabase
        .from(DATABASE_TABLES.PROFILES)

        .insert(insertData as any);

      const { data } = error
        ? { data: null }
        : await fromTable(supabase, OWN_PROFILE_VIEW).select('*').single();

      if (error) {
        logger.error('ProfileWriter.createProfile database error:', error);

        if (error.code === '23505') {
          return { success: false, error: 'Profile already exists or username is taken' };
        }

        return { success: false, error: 'Failed to create profile. Please try again.' };
      }

      const newProfile = ProfileMapper.mapDatabaseToProfile(data);
      logger.info('[Profile] createProfile success', { userId, profile: newProfile });

      return { success: true, data: newProfile ?? undefined };
    } catch (err) {
      logger.error('ProfileWriter.createProfile unexpected error:', err);
      return { success: false, error: 'An unexpected error occurred while creating profile' };
    }
  }

  /**
   * Delete profile
   */
  static async deleteProfile(userId: string): Promise<ProfileServiceResponse<void>> {
    if (!userId?.trim()) {
      return { success: false, error: 'User ID is required' };
    }

    try {
      // Verify authentication
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { success: false, error: 'Authentication required' };
      }

      if (user.id !== userId) {
        return { success: false, error: 'Permission denied: Can only delete your own profile' };
      }

      logger.info('[Profile] deleteProfile', { userId });

      const { error } = await fromTable(supabase, DATABASE_TABLES.PROFILES)
        .delete()
        .eq('id', userId);

      if (error) {
        logger.error('ProfileWriter.deleteProfile error:', error);
        return { success: false, error: 'Failed to delete profile' };
      }

      logger.info('[Profile] deleteProfile success', { userId });
      return { success: true };
    } catch (err) {
      logger.error('ProfileWriter.deleteProfile unexpected error:', err);
      return { success: false, error: 'An unexpected error occurred while deleting profile' };
    }
  }

  /**
   * Direct partial profile update by user id.
   *
   * Was previously an `update_profile` Postgres RPC — but that function never
   * existed on the self-hosted DB (PGRST202), so every call silently failed.
   * Its one live caller is the intelligent-onboarding step that persists the
   * new user's name/bio/onboarding flags; that data was being thrown away,
   * which is why freshly-onboarded users still showed as "User". This now does
   * the direct table update its name always implied. RLS lets a user update
   * their own row, so no SECURITY DEFINER function is needed.
   */
  static async fallbackUpdate(
    userId: string,
    updates: Record<string, unknown>
  ): Promise<ProfileServiceResponse<unknown>> {
    if (!userId?.trim()) {
      return { success: false, error: 'User ID is required' };
    }

    try {
      // Update without RETURNING, then read the row back through the
      // owner-scoped view — see updateProfile above for why.
      const { error } = await fromTable(supabase, DATABASE_TABLES.PROFILES)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId);

      const { data } = error
        ? { data: null }
        : await fromTable(supabase, OWN_PROFILE_VIEW).select('*').single();

      if (error) {
        logger.error('ProfileWriter.fallbackUpdate error:', error);
        return { success: false, error: 'Profile update failed: ' + error.message };
      }

      return { success: true, data: Array.isArray(data) ? data[0] : data };
    } catch (err) {
      logger.error('ProfileWriter.fallbackUpdate unexpected error:', err);
      return { success: false, error: 'An unexpected error occurred during fallback update' };
    }
  }
}

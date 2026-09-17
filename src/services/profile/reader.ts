/**
 * PROFILE READER MODULE
 *
 * Created: 2025-01-09
 * Last Modified: 2025-01-09
 * Last Modified Summary: Extracted from profileService.ts for modular architecture - handles read operations
 */

import { fromTable } from '@/lib/supabase/untyped';
import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { ProfileMapper } from './mapper';
import type { ScalableProfile } from './types';
import { DATABASE_TABLES, PUBLIC_PROFILES_VIEW } from '@/config/database-tables';

// =====================================================================
// 📖 PROFILE RETRIEVAL OPERATIONS
// =====================================================================

/**
 * Reads here go through PUBLIC_PROFILES_VIEW, not the `profiles` table.
 *
 * Every method below uses the BROWSER client, which runs as `anon` when logged
 * out and `authenticated` when logged in — and neither role can read
 * profiles.email / .phone / .contact_email any more (20260917120100 and
 * 20260917163100). `select('*')` on the table therefore fails outright for both,
 * so these had to move whoever is calling.
 *
 * The view is also the right answer on the merits: these are "look somebody up"
 * operations over an arbitrary id or search term, and nobody is entitled to
 * another person's private columns. A signed-in user reading their OWN row uses
 * ProfileServerService.getOwnProfile (GET /api/profile), which reads the
 * owner-scoped view and does return them.
 */
export class ProfileReader {
  /**
   * Get a profile's public fields. NOT the caller's private columns, even when
   * `userId` is the caller — see the class note above.
   */
  static async getProfile(userId: string): Promise<ScalableProfile | null> {
    if (!userId?.trim()) {
      logger.warn('ProfileReader.getProfile: Empty user ID provided');
      return null;
    }

    try {
      logger.info('[Profile] getProfile', { userId });

      const { data, error } = await fromTable(supabase, PUBLIC_PROFILES_VIEW)
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          logger.info(`Profile not found for user: ${userId}`);
          return null;
        }
        logger.error('ProfileReader.getProfile error:', error);
        return null;
      }

      if (!data) {
        return null;
      }

      const profile = ProfileMapper.mapDatabaseToProfile(data);
      logger.info('[Profile] getProfile success', { userId, hasProfile: true });
      return profile;
    } catch (err) {
      logger.error('ProfileReader.getProfile unexpected error:', err);
      return null;
    }
  }

  /**
   * Get multiple profiles with pagination and filtering
   */
  static async getProfiles(
    options: {
      limit?: number;
      offset?: number;
      orderBy?: string;
      orderDirection?: 'asc' | 'desc';
    } = {}
  ): Promise<ScalableProfile[]> {
    try {
      const { limit = 20, offset = 0, orderBy = 'created_at', orderDirection = 'desc' } = options;

      const { data, error } = await fromTable(supabase, PUBLIC_PROFILES_VIEW)
        .select('*')
        .order(orderBy, { ascending: orderDirection === 'asc' })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('ProfileReader.getProfiles error:', {
          message: error.message,
          code: error.code,
        });
        return [];
      }

      return (data?.map(profile => ProfileMapper.mapDatabaseToProfile(profile)) || []).filter(
        (p): p is ScalableProfile => p !== null
      );
    } catch (err) {
      logger.error('ProfileReader.getProfiles unexpected error:', err);
      return [];
    }
  }

  /**
   * Search profiles with basic text search
   */
  static async searchProfiles(
    searchTerm: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<ScalableProfile[]> {
    if (!searchTerm?.trim()) {
      return [];
    }

    try {
      const escapedTerm = searchTerm.replace(/[%_]/g, '\\$&');
      const { data, error } = await fromTable(supabase, PUBLIC_PROFILES_VIEW)
        .select('*')
        .or(`username.ilike.%${escapedTerm}%,name.ilike.%${escapedTerm}%`)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('ProfileReader.searchProfiles error:', error);
        return [];
      }

      return (data?.map(profile => ProfileMapper.mapDatabaseToProfile(profile)) || []).filter(
        (p): p is ScalableProfile => p !== null
      );
    } catch (err) {
      logger.error('ProfileReader.searchProfiles unexpected error:', err);
      return [];
    }
  }

  /**
   * Get all profiles (admin function)
   */
  static async getAllProfiles(): Promise<ScalableProfile[]> {
    try {
      const { data, error } = await fromTable(supabase, PUBLIC_PROFILES_VIEW)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('ProfileReader.getAllProfiles error:', error);
        return [];
      }

      return (data?.map(profile => ProfileMapper.mapDatabaseToProfile(profile)) || []).filter(
        (p): p is ScalableProfile => p !== null
      );
    } catch (err) {
      logger.error('ProfileReader.getAllProfiles unexpected error:', err);
      return [];
    }
  }

  /**
   * Increment profile views (read-adjacent operation)
   */
  static async incrementProfileViews(userId: string): Promise<void> {
    if (!userId?.trim()) {
      return;
    }

    try {
      // Get current view count
      const profile = await this.getProfile(userId);
      if (!profile) {
        return;
      }

      // Update view count
      await fromTable(supabase, DATABASE_TABLES.PROFILES)
        .update({
          website: JSON.stringify({
            ...JSON.parse(profile.website || '{}'),
            last_viewed_at: new Date().toISOString(),
          }),
        })
        .eq('id', userId);
    } catch (err) {
      logger.error('ProfileReader.incrementProfileViews error:', err);
    }
  }
}

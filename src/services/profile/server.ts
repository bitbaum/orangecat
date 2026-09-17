/**
 * PROFILE SERVER SERVICE - Server-side profile operations for API routes
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Created server-side profile service to eliminate direct database access in API routes
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';
import type { Database } from '@/types/database';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getTableName } from '@/config/entity-registry';
import { getOrCreateUserActor } from '@/services/actors/getOrCreateUserActor';
import { ownedProjectsFilter } from '@/domain/projects/service';
import { STATUS } from '@/config/database-constants';
import { neutralUsernameFor } from '@/lib/profile/neutral-username';
import { resolveHistoricalUsername } from '@/domain/lightning-address/username-history';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
type _ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

/**
 * Server-side profile service functions
 * Accepts a Supabase client to work in API routes
 */
export class ProfileServerService {
  /**
   * Get profile by user ID
   */
  static async getProfile(
    supabase: AnySupabaseClient,
    userId: string
  ): Promise<{ data: ProfileRow | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from(DATABASE_TABLES.PROFILES)
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { data: null, error: null }; // Not found
        }
        logger.error('ProfileServerService.getProfile error', error, 'ProfileServer');
        return { data: null, error: error as Error };
      }

      return { data, error: null };
    } catch (err) {
      logger.error('ProfileServerService.getProfile unexpected error', err, 'ProfileServer');
      return { data: null, error: err as Error };
    }
  }

  /**
   * Check if username is available
   *
   * Checks the handles nobody uses any more as well as the live ones. A
   * retired handle still resolves — /profiles/<old> 301s to its owner's
   * current handle and <old>@orangecat.ch still finds them through
   * profile_username_history — and the live profiles table is consulted
   * FIRST, so reissuing one to somebody else would silently hand them the
   * previous owner's inbound links and Lightning payments.
   *
   * The database refuses that write regardless (profiles_username_rename_guard,
   * 20260829090000) — that is where the rule is enforced, because it has to
   * hold for every writer. This check exists so the person typing the handle
   * finds out from the form that it is taken, instead of from a failed save.
   */
  static async checkUsernameAvailability(
    supabase: AnySupabaseClient,
    username: string,
    excludeUserId?: string
  ): Promise<boolean> {
    try {
      const trimmed = username.trim();

      const retiredBy = await resolveHistoricalUsername(supabase, trimmed);
      if (retiredBy && retiredBy !== excludeUserId) {
        return false;
      }

      let query = supabase.from(DATABASE_TABLES.PROFILES).select('id').eq('username', trimmed);

      if (excludeUserId) {
        query = query.neq('id', excludeUserId);
      }

      const { data } = await query.single();

      return !data; // true if available (no data found)
    } catch (err) {
      // If error is "no rows", username is available
      if (err instanceof Error && err.message.includes('No rows')) {
        return true;
      }
      logger.error('ProfileServerService.checkUsernameAvailability error', err, 'ProfileServer');
      return false; // Err on the side of caution
    }
  }

  /**
   * Create a new profile
   */
  static async createProfile(
    supabase: AnySupabaseClient,
    profileData: ProfileInsert
  ): Promise<{ data: ProfileRow | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from(DATABASE_TABLES.PROFILES)
        .insert(profileData)
        .select()
        .single();

      if (error) {
        logger.error('ProfileServerService.createProfile error', error, 'ProfileServer');
        return { data: null, error: error as Error };
      }

      return { data, error: null };
    } catch (err) {
      logger.error('ProfileServerService.createProfile unexpected error', err, 'ProfileServer');
      return { data: null, error: err as Error };
    }
  }

  /**
   * Ensure profile exists, creating it if it doesn't
   */
  static async ensureProfile(
    supabase: AnySupabaseClient,
    userId: string,
    userEmail?: string | null,
    userMetadata?: Record<string, any> | null
  ): Promise<{ data: ProfileRow | null; error: Error | null }> {
    try {
      // Check if profile exists
      const { data: existing, error: checkError } = await supabase
        .from(DATABASE_TABLES.PROFILES)
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        logger.error('ProfileServerService.ensureProfile check error', checkError, 'ProfileServer');
        return { data: null, error: checkError as Error };
      }

      if (existing) {
        // Profile exists, fetch full profile
        return this.getProfile(supabase, userId);
      }

      // Profile doesn't exist, create it
      const safeEmail = typeof userEmail === 'string' ? userEmail : null;
      // Never the email local part. This path creates profiles independently of
      // the handle_new_user trigger, so fixing only the trigger left this one
      // still publishing people's email prefixes as crawlable handles — which
      // is what took the count from 72 to 77 while the trigger fix was being
      // written. The display name gets no email fallback either: a name quietly
      // set to someone's email prefix is the same leak wearing another label.
      const username = neutralUsernameFor(userId);
      const name =
        (userMetadata?.full_name as string | undefined) ||
        (userMetadata?.name as string | undefined) ||
        (userMetadata?.display_name as string | undefined) ||
        'User';

      const profileData: ProfileInsert = {
        id: userId,
        username,
        name,
        email: safeEmail,
        status: STATUS.PROFILES.ACTIVE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await this.createProfile(supabase, profileData);

      // Create actor eagerly so it exists before the user creates any entity.
      // This eliminates the lazy-creation gap where the Cat and other services
      // can't find the actor for a new user.
      if (result.data) {
        try {
          await getOrCreateUserActor(userId);
        } catch (actorErr) {
          // Non-fatal — actor will be created lazily on first entity creation
          logger.warn(
            'Failed to eagerly create actor for new user',
            { userId, error: actorErr },
            'ProfileServer'
          );
        }
      }

      return result;
    } catch (err) {
      logger.error('ProfileServerService.ensureProfile unexpected error', err, 'ProfileServer');
      return { data: null, error: err as Error };
    }
  }

  /**
   * Get project count for a user
   */
  static async getProjectCount(supabase: AnySupabaseClient, userId: string): Promise<number> {
    try {
      // By owning actor, not creating account — see ownedProjectsFilter.
      const actor = await getOrCreateUserActor(userId);
      const { count, error } = await supabase
        .from(getTableName('project'))
        .select('*', { count: 'exact', head: true })
        .or(ownedProjectsFilter(actor.id, userId));

      if (error) {
        logger.error('ProfileServerService.getProjectCount error', error, 'ProfileServer');
        return 0;
      }

      return count || 0;
    } catch (err) {
      logger.error('ProfileServerService.getProjectCount unexpected error', err, 'ProfileServer');
      return 0;
    }
  }
}

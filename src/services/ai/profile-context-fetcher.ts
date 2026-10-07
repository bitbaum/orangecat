/**
 * The profile as the Cat reads it. Split from document-context.ts (500-line
 * service limit) when `timezone` joined the columns: "today" in the Cat's
 * context is the person's today, and this is where the zone comes from.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';
import type { ProfileContext } from './document-context-types';

export async function fetchProfileForCat(
  supabase: AnySupabaseClient,
  userId: string
): Promise<ProfileContext | null> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('username, name, bio, location_city, location_country, background, website, timezone')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      return null;
    }

    return {
      username: profile.username,
      name: profile.name,
      bio: profile.bio,
      location_city: profile.location_city,
      location_country: profile.location_country,
      background: profile.background,
      website: profile.website,
      timezone: profile.timezone ?? undefined,
    };
  } catch (error) {
    logger.error('Exception fetching profile for cat', error, 'DocumentContext');
    return null;
  }
}

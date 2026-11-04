/**
 * Public-facing economic-profile read — the only accessor safe to use for a
 * viewer who might not be the profile's owner. Split out from
 * economic-profile.ts to keep that file under its service-file line budget
 * (.claude/rules/code-quality.md); the two stayed one file at first because
 * the type they share is trivially derived, but the accessor itself has
 * nothing to do with the private read/write/extraction logic there.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';
import type { PublicEconomicProfile } from './economic-profile';
import { offeringFields } from '@/domain/profile/offerings';

/**
 * The public-facing slice only — served from user_economic_profile_public,
 * which the RLS policies on the base table cannot expose to a visitor who
 * isn't the owner. Use this (never getEconomicProfile) anywhere a profile is
 * rendered for someone who might not be its owner, e.g. the public profile
 * page.
 */
export async function getPublicEconomicProfile(
  supabase: AnySupabaseClient,
  userId: string
): Promise<PublicEconomicProfile | null> {
  try {
    const { data, error } = await supabase
      .from(DATABASE_TABLES.USER_ECONOMIC_PROFILE_PUBLIC)
      .select('skills, assets, asked_for, not_available_for')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      logger.warn('getPublicEconomicProfile query failed', { error }, 'EconomicProfile');
      return null;
    }
    if (!data) {
      return null;
    }
    return offeringFields(data as Record<string, unknown>);
  } catch (err) {
    logger.warn('getPublicEconomicProfile failed', { err: String(err) }, 'EconomicProfile');
    return null;
  }
}

/**
 * Shared Search Query Helpers
 *
 * Common utilities used across search query modules:
 * - Query sanitization
 * - Profile map building
 * - Haversine distance calculation
 */

import supabase from '@/lib/supabase/browser';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { ProfileReference } from '../types';

/**
 * Fetch profiles for a set of user IDs and return a lookup map.
 */
export async function buildProfileMap(
  userIds: string[]
): Promise<Map<string, ProfileReference & { name: string | null }>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const { data: profiles } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('id, username, name, avatar_url')
    .in('id', userIds);

  return new Map(
    (profiles as ProfileReference[] | null)?.map(p => [p.id, { ...p, name: p.name }]) || []
  );
}

/**
 * Calculate distance between two coordinates using the Haversine formula.
 * @returns Distance in kilometers
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

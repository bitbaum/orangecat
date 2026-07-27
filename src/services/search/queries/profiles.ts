/**
 * Profile Search Queries
 *
 * Handles database queries for searching user profiles,
 * including full-text search, geo/radius search, and ILIKE fallback.
 */

import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { SearchProfile, SearchFilters, RawSearchProfile } from '../types';
import { sanitizeQuery, haversineDistance } from './helpers';

/**
 * Search profiles with filters
 */
export async function searchProfiles(
  query?: string,
  filters?: SearchFilters,
  limit: number = 20,
  offset: number = 0
): Promise<SearchProfile[]> {
  // Start with minimal columns for better performance
  let profileQuery = supabase
    .from(DATABASE_TABLES.PROFILES)
    .select(
      'id, username, name, bio, avatar_url, created_at, location_country, location_city, location_zip, latitude, longitude, current_status'
    );

  // Priority 1: If radius is specified, use PostGIS RPC (handles both query and radius)
  if (filters?.radius_km && filters.lat !== undefined && filters.lng !== undefined) {
    try {
      const { data, error } = await supabase.rpc('search_profiles_nearby', {
        p_lat: filters.lat,
        p_lng: filters.lng,
        p_radius_km: filters.radius_km,
        p_query: query || null,
        p_limit: limit,
        p_offset: offset,
      } as any);

      if (!error && data) {
        // Apply additional location filters if needed
        let results = data as RawSearchProfile[];
        results = applyLocationFilters(results, filters);

        return results.map(p => ({
          ...p,
          name: p.name,
        }));
      }
    } catch (rpcError) {
      // Fall back to bounding box if RPC not available
      logger.warn('PostGIS RPC not available, using bounding box', rpcError, 'Search');
    }
  }

  // Priority 2: If query is specified (and no radius), use full-text search RPC
  if (query) {
    try {
      const { data, error } = await supabase.rpc('search_profiles_fts', {
        p_query: query,
        p_limit: limit,
        p_offset: offset,
      } as any);

      if (!error && data) {
        // Apply location filters to RPC results if needed
        let results = data as RawSearchProfile[];
        if (filters) {
          results = applyLocationFilters(results, filters);
        }

        return results.map(p => ({
          ...p,
          name: p.name,
        }));
      }
    } catch (rpcError) {
      // Fall back to ILIKE if RPC function doesn't exist yet
      logger.warn('Full-text search RPC not available, using ILIKE', rpcError, 'Search');
    }
  }

  // Fallback: Use standard Supabase query builder with ILIKE
  if (query) {
    const sanitized = sanitizeQuery(query);
    profileQuery = profileQuery.or(
      `username.ilike.%${sanitized}%,name.ilike.%${sanitized}%,bio.ilike.%${sanitized}%`
    );
  }

  // Apply location filters
  if (filters) {
    if (filters.country) {
      profileQuery = profileQuery.eq('location_country', filters.country.toUpperCase());
    }

    if (filters.city) {
      const sanitizedCity = sanitizeQuery(filters.city);
      profileQuery = profileQuery.ilike('location_city', `%${sanitizedCity}%`);
    }

    if (filters.postal_code) {
      profileQuery = profileQuery.eq('location_zip', filters.postal_code);
    }

    // Bounding box fallback for radius (if PostGIS RPC failed)
    if (filters.radius_km && filters.lat !== undefined && filters.lng !== undefined) {
      const radiusDegrees = filters.radius_km / 111.0;
      profileQuery = profileQuery
        .gte('latitude', filters.lat - radiusDegrees)
        .lte('latitude', filters.lat + radiusDegrees)
        .gte('longitude', filters.lng - radiusDegrees)
        .lte('longitude', filters.lng + radiusDegrees);
    }
  }

  // Use created_at index for better performance
  const { data: profiles, error } = await profileQuery
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  let results = ((profiles as RawSearchProfile[]) || []).map(p => ({
    ...p,
    name: p.name,
  }));

  // Apply precise radius filtering if needed (Haversine formula)
  // Note: This is fallback code - PostGIS RPC is prioritized above
  if (filters?.radius_km && filters.lat !== undefined && filters.lng !== undefined) {
    results = results.filter(profile => {
      if (!profile.latitude || !profile.longitude) {
        return false;
      }
      const distance = haversineDistance(
        filters.lat!,
        filters.lng!,
        profile.latitude,
        profile.longitude
      );
      return distance <= filters.radius_km!;
    });
  }

  return results;
}

/**
 * Apply location filters to an array of raw profile results.
 */
function applyLocationFilters(
  results: RawSearchProfile[],
  filters: SearchFilters
): RawSearchProfile[] {
  let filtered = results;

  if (filters.country) {
    filtered = filtered.filter(p => p.location_country === filters.country!.toUpperCase());
  }
  if (filters.city) {
    const sanitizedCity = sanitizeQuery(filters.city);
    filtered = filtered.filter(p =>
      p.location_city?.toLowerCase().includes(sanitizedCity.toLowerCase())
    );
  }
  if (filters.postal_code) {
    filtered = filtered.filter(p => p.location_zip === filters.postal_code);
  }

  return filtered;
}

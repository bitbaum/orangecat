/**
 * WISHLIST DOMAIN SERVICE
 *
 * Business logic for wishlists.
 *
 * Created: 2026-01-07
 * Last Modified: 2026-03-31
 * Last Modified Summary: Refactored to use generic base entity service for create
 */

import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import { createEntity, withResolvedActor } from '@/domain/base/entityService';
import { getOrCreateUserActor } from '@/services/actors/getOrCreateUserActor';
import type { WishlistFormData } from '@/lib/validation';

export async function listWishlistsPage(
  limit: number,
  offset: number,
  userId?: string,
  /**
   * When false, hides non-public wishlists. Must be derived from
   * `shouldIncludeDrafts(requestedUserId, authenticatedUserId)` at the
   * API-route layer — never trust the raw `?user_id=` query param.
   * Default false: private wishlists never leak to unauthenticated callers.
   */
  includeOwnDrafts = false
) {
  const supabase = await createServerClient();

  let query = supabase.from(DATABASE_TABLES.WISHLIST_WITH_STATS).select('*', { count: 'exact' });

  if (userId) {
    const actor = await getOrCreateUserActor(userId);
    query = query.eq('actor_id', actor.id);
  }

  // Only the owner can see private/inactive wishlists. Anonymous or
  // cross-user requesters get the public, active set only.
  if (!includeOwnDrafts) {
    query = query.eq('visibility', 'public').eq('is_active', true);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error('Failed to list wishlists', { error: error.message, userId });
    throw error;
  }

  // Type for wishlist data from view
  type WishlistWithStats = {
    id: string;
    actor_id: string;
    title: string;
    description?: string | null;
    item_count?: number;
    [key: string]: unknown;
  };

  // Transform data to include items_count from item_count view field
  const items = ((data || []) as WishlistWithStats[]).map(w => ({
    ...w,
    items_count: w.item_count || 0,
  }));

  return { items, total: count || 0 };
}

export async function createWishlist(userId: string, data: WishlistFormData) {
  return createEntity(
    'wishlist',
    userId,
    withResolvedActor(data, {
      title: data.title,
      description: data.description,
      type: data.type,
      visibility: data.visibility,
      // Default to draft (false), not active. Earlier `?? true` forced every
      // new wishlist live regardless of caller intent or schema default,
      // which is what surfaced the privacy-bug verify finding (UI promised
      // "saved as draft, not visible" while the row landed is_active=true,
      // visibility='public').
      is_active: data.is_active ?? false,
      cover_image_url: data.cover_image_url,
      event_date: data.event_date,
    })
  );
}

/**
 * AI assistant collection domain logic (server-only).
 *
 * List (public catalog / owner drafts) and create for AI assistants. Kept out of
 * the API route so it stays a thin validate → delegate → respond wrapper. Each
 * function returns a discriminated result the route maps to an HTTP response
 * (no HTTP concerns in this layer).
 */

import { z } from 'zod';
import { aiAssistantSchema } from '@/lib/validation';
import { STATUS } from '@/config/database-constants';
import { getTableName } from '@/config/entity-registry';
import { getUserActorId } from '@/domain/actors';
import { getOrCreateUserActor } from '@/services/actors/getOrCreateUserActor';
import { logger } from '@/utils/logger';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export type AssistantResult<T> = { ok: true; data: T } | { ok: false; dbError: unknown };

export type AiAssistantInput = z.infer<typeof aiAssistantSchema>;

export interface ListAssistantsParams {
  limit: number;
  offset: number;
  category?: string | null;
  /** `user_id` query param — scopes results to that user's actor. */
  userId?: string | null;
  searchQuery?: string | null;
  sortBy: string;
  /** Authenticated viewer's id, used to decide whether own drafts are included. */
  viewerId?: string | null;
}

function applySortOrder<T extends { order(col: string, opts?: object): T }>(
  query: T,
  sortBy: string
): T {
  switch (sortBy) {
    case 'rating':
      return query.order('average_rating', { ascending: false, nullsFirst: false });
    case 'recent':
      return query.order('created_at', { ascending: false });
    case 'price_low':
      return query.order('price_per_message', { ascending: true, nullsFirst: false });
    case 'price_high':
      return query.order('price_per_message', { ascending: false, nullsFirst: false });
    default:
      return query.order('total_conversations', { ascending: false, nullsFirst: false });
  }
}

/** List public assistants (or a specific user's, including own drafts when the viewer owns them). */
export async function listAssistants(
  supabase: AnySupabaseClient,
  params: ListAssistantsParams
): Promise<AssistantResult<{ items: unknown[]; count: number }>> {
  const { limit, offset, category, userId, searchQuery, sortBy, viewerId } = params;

  const includeOwnDrafts = Boolean(userId && viewerId && userId === viewerId);
  const tableName = getTableName('ai_assistant');

  let itemsQuery = supabase
    .from(tableName)
    .select('*, user:profiles!ai_assistants_user_id_fkey(id, username, name, avatar_url)')
    .range(offset, offset + limit - 1);
  let countQuery = supabase.from(tableName).select('*', { count: 'exact', head: true });

  let actorId: string | null = null;
  if (userId) {
    // Listing is a read path: an account without an actor simply owns no
    // assistants yet. Actor creation belongs to createAssistant, never GET.
    actorId = await getUserActorId(supabase, userId);
  }

  if (userId && includeOwnDrafts && actorId) {
    itemsQuery = itemsQuery.eq('actor_id', actorId);
    countQuery = countQuery.eq('actor_id', actorId);
  } else {
    itemsQuery = itemsQuery.eq('status', STATUS.AI_ASSISTANTS.ACTIVE).eq('is_public', true);
    countQuery = countQuery.eq('status', STATUS.AI_ASSISTANTS.ACTIVE).eq('is_public', true);
    if (actorId) {
      itemsQuery = itemsQuery.eq('actor_id', actorId);
      countQuery = countQuery.eq('actor_id', actorId);
    }
    if (category) {
      itemsQuery = itemsQuery.eq('category', category);
      countQuery = countQuery.eq('category', category);
    }
  }

  if (searchQuery) {
    const escaped = searchQuery.replace(/[%_]/g, '\\$&');
    const filter = `title.ilike.%${escaped}%,description.ilike.%${escaped}%`;
    itemsQuery = itemsQuery.or(filter);
    countQuery = countQuery.or(filter);
  }

  itemsQuery = applySortOrder(itemsQuery, sortBy);

  const [{ data: items, error: itemsError }, { count, error: countError }] = await Promise.all([
    itemsQuery,
    countQuery,
  ]);
  if (itemsError) {
    return { ok: false, dbError: itemsError };
  }
  if (countError) {
    return { ok: false, dbError: countError };
  }

  return { ok: true, data: { items: items || [], count: count || 0 } };
}

/** Create a draft AI assistant owned by the user. */
export async function createAssistant(
  supabase: AnySupabaseClient,
  userId: string,
  d: AiAssistantInput
): Promise<AssistantResult<Record<string, unknown>>> {
  const actor = await getOrCreateUserActor(userId);

  const { data: assistant, error } = await supabase
    .from(getTableName('ai_assistant'))
    .insert({
      user_id: userId,
      actor_id: actor.id,
      title: d.title,
      description: d.description,
      category: d.category,
      tags: d.tags || [],
      avatar_url: d.avatar_url,
      system_prompt: d.system_prompt,
      welcome_message: d.welcome_message,
      personality_traits: d.personality_traits || [],
      knowledge_base_urls: d.knowledge_base_urls || [],
      model_preference: d.model_preference || 'any',
      max_tokens_per_response: d.max_tokens_per_response || 1000,
      temperature: d.temperature || 0.7,
      compute_provider_type: d.compute_provider_type || 'api',
      compute_provider_id: d.compute_provider_id,
      api_provider: d.api_provider,
      pricing_model: d.pricing_model || 'free',
      price_per_message: d.price_per_message || 0,
      price_per_1k_tokens: d.price_per_1k_tokens || 0,
      subscription_price: d.subscription_price || 0,
      free_messages_per_day: d.free_messages_per_day || 0,
      status: STATUS.AI_ASSISTANTS.DRAFT,
      is_public: false,
      is_featured: false,
      lightning_address: d.lightning_address,
      bitcoin_address: d.bitcoin_address,
    })
    .select()
    .single();

  if (error) {
    logger.error('AI Assistant creation failed', { userId, error: error.message });
    return { ok: false, dbError: error };
  }

  logger.info('AI Assistant created successfully', {
    assistantId: assistant.id,
    userId,
  });
  return { ok: true, data: assistant };
}

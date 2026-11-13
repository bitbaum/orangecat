/**
 * Provenance: what the Cat or a bot made.
 *
 * When a `create_<entity type>` action succeeds, the executor records which
 * agent made the new entity: the person's Cat, or the bot (companion) whose
 * proposal the person confirmed. The public page reads it back as a byline,
 * "Made with <bot>", so a bot's work carries its name the way a person's does.
 *
 * Service role only (see the migration
 * 20261113193700_what_a_bot_made_carries_its_name.sql): the executor writes
 * after the handler succeeded, the page reads server-side. Recording is best
 * effort: a failed write never fails the action the person confirmed.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { isValidEntityType, type EntityType } from '@/config/entity-registry';
import { getAdminClient } from '@/lib/supabase/admin';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { fromTable } from '@/lib/supabase/untyped';
import { logger } from '@/utils/logger';

const LOG = 'Provenance';

/** `create_product` → `product`; null for any action that does not make an entity. */
export function createdEntityType(actionId: string): EntityType | null {
  const match = /^create_([a-z_]+)$/.exec(actionId);
  return match && isValidEntityType(match[1]) ? match[1] : null;
}

/** The new row's id from a handler's result, which spreads the inserted row. */
export function createdEntityId(data: unknown): string | null {
  const id = (data as { id?: unknown } | null | undefined)?.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * Which bot a conversation is with, when it is one of the person's own bot
 * conversations. A Cat conversation (or none) is the Cat.
 */
async function botOfConversation(
  admin: AnySupabaseClient,
  userId: string,
  conversationId: string | null | undefined
): Promise<string | null> {
  if (!conversationId) {
    return null;
  }
  const { data } = await fromTable(admin, DATABASE_TABLES.AI_CONVERSATIONS)
    .select('assistant_id')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data as { assistant_id?: string } | null)?.assistant_id ?? null;
}

/** Record that an action made an entity. Never throws. */
export async function recordProvenance(input: {
  actionId: string;
  userId: string;
  conversationId?: string | null;
  data: unknown;
}): Promise<void> {
  const entityType = createdEntityType(input.actionId);
  const entityId = createdEntityId(input.data);
  if (!entityType || !entityId) {
    return;
  }
  try {
    const admin = getAdminClient() as unknown as AnySupabaseClient;
    const assistantId = await botOfConversation(admin, input.userId, input.conversationId);
    const { error } = await fromTable(admin, DATABASE_TABLES.ENTITY_PROVENANCE).upsert(
      {
        entity_type: entityType,
        entity_id: entityId,
        made_by: assistantId ? 'bot' : 'cat',
        made_with_assistant_id: assistantId,
      },
      { onConflict: 'entity_type,entity_id', ignoreDuplicates: true }
    );
    if (error) {
      logger.warn('Could not record provenance', { entityType, error: error.message }, LOG);
    }
  } catch (error) {
    logger.warn('Could not record provenance', { entityType, error }, LOG);
  }
}

export interface Provenance {
  madeBy: 'cat' | 'bot';
  /** The bot, when it is public: a private or deleted bot is not named. */
  bot: { id: string; name: string; avatarUrl: string | null } | null;
}

/** Who made this entity, or null when a person made it by hand. */
export async function getProvenance(
  entityType: EntityType,
  entityId: string
): Promise<Provenance | null> {
  try {
    const admin = getAdminClient() as unknown as AnySupabaseClient;
    const { data } = await fromTable(admin, DATABASE_TABLES.ENTITY_PROVENANCE)
      .select('made_by, made_with_assistant_id')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .maybeSingle();
    const row = data as { made_by?: string; made_with_assistant_id?: string | null } | null;
    if (!row || (row.made_by !== 'cat' && row.made_by !== 'bot')) {
      return null;
    }
    if (row.made_by === 'cat' || !row.made_with_assistant_id) {
      return { madeBy: row.made_by, bot: null };
    }
    const { data: bot } = await fromTable(admin, DATABASE_TABLES.AI_ASSISTANTS)
      .select('id, title, avatar_url, is_public')
      .eq('id', row.made_with_assistant_id)
      .maybeSingle();
    const b = bot as { id: string; title: string; avatar_url: string | null; is_public: boolean };
    return {
      madeBy: 'bot',
      bot: b?.is_public ? { id: b.id, name: b.title, avatarUrl: b.avatar_url } : null,
    };
  } catch (error) {
    logger.warn('Could not read provenance', { entityType, error }, LOG);
    return null;
  }
}

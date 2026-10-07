/**
 * Actor Service
 *
 * Unified service for managing actors (users and groups).
 * Provides ownership checks and actor information.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Created actor service
 */

import defaultBrowserClient from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { Actor } from './types/actor';

// All public functions in this module accept an optional `client` parameter.
// Callers from a server-side context (API routes, edge functions) MUST pass
// the authed server client they already hold; the default browser client
// has no cookies/auth in serverless and was the silent root cause of the
// Publish Now 404 across every entity (fix 136f65ac inlined the workaround
// in the STATUS route; this is the source-level fix so other callers stop
// silently failing).
function pickClient(client?: AnySupabaseClient): AnySupabaseClient {
  return client ?? (defaultBrowserClient as unknown as AnySupabaseClient);
}

/**
 * Get actor by ID
 */
export async function getActor(actorId: string, client?: AnySupabaseClient): Promise<Actor | null> {
  const supabase = pickClient(client);
  try {
    const { data, error } = await supabase
      .from(DATABASE_TABLES.ACTORS)
      .select('*')
      .eq('id', actorId)
      .maybeSingle();

    if (error) {
      logger.error('Failed to get actor', error, 'Actors');
      return null;
    }

    return data as Actor | null;
  } catch (error) {
    logger.error('Exception getting actor', error, 'Actors');
    return null;
  }
}

/**
 * Get actor by group ID
 */
export async function getActorByGroup(
  groupId: string,
  client?: AnySupabaseClient
): Promise<Actor | null> {
  const supabase = pickClient(client);
  try {
    const { data, error } = await supabase
      .from(DATABASE_TABLES.ACTORS)
      .select('*')
      .eq('actor_type', 'group')
      .eq('group_id', groupId)
      .maybeSingle();

    if (error) {
      logger.error('Failed to get actor by group', error, 'Actors');
      return null;
    }

    return data as Actor | null;
  } catch (error) {
    logger.error('Exception getting actor by group', error, 'Actors');
    return null;
  }
}

/**
 * Check if user owns or has access to entity
 */
export async function checkOwnership(
  entity: { actor_id: string | null },
  userId: string,
  client?: AnySupabaseClient
): Promise<boolean> {
  const supabase = pickClient(client);
  try {
    if (!entity.actor_id) {
      return false;
    }

    const actor = await getActor(entity.actor_id, supabase);
    if (!actor) {
      return false;
    }

    // If actor is a user, check direct ownership
    if (actor.actor_type === 'user') {
      return actor.user_id === userId;
    }

    // If actor is a group, check membership
    if (actor.actor_type === 'group') {
      const { data: membership } = await supabase
        .from(DATABASE_TABLES.GROUP_MEMBERS)
        .select('role')
        .eq('group_id', actor.group_id!)
        .eq('user_id', userId)
        .maybeSingle();

      return !!membership;
    }

    return false;
  } catch (error) {
    logger.error('Exception checking ownership', error, 'Actors');
    return false;
  }
}

/**
 * Get actor display name by joining profiles (for user actors) or groups (for group actors)
 */
export async function getActorDisplayName(
  actorId: string,
  client?: AnySupabaseClient
): Promise<string> {
  const supabase = pickClient(client);
  try {
    const { data, error } = await supabase
      .from(DATABASE_TABLES.ACTORS)
      .select(
        `
        id, actor_type, user_id, group_id,
        profiles:user_id (name, username),
        groups:group_id (name)
      `
      )
      .eq('id', actorId)
      .maybeSingle();

    if (error || !data) {
      logger.error('Failed to get actor display name', error, 'Actors');
      return 'Unknown';
    }

    const actor = data as unknown as {
      actor_type: string;
      profiles: { name: string | null; username: string | null } | null;
      groups: { name: string | null } | null;
    };
    if (actor.actor_type === 'user') {
      return actor.profiles?.name || actor.profiles?.username || 'Unknown';
    }
    if (actor.actor_type === 'group') {
      return actor.groups?.name || 'Unknown';
    }

    return 'Unknown';
  } catch (error) {
    logger.error('Exception getting actor display name', error, 'Actors');
    return 'Unknown';
  }
}

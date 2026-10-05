/**
 * Display names for a set of actors — what a list of reviews, deals or
 * counterparties shows next to each row.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { fromTable } from '@/lib/supabase/untyped';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export interface ActorName {
  actor_id: string;
  name: string | null;
  username: string | null;
}

/**
 * Two queries, not an embed: the live DB has no FK from actors.user_id to
 * profiles (see fetchEntityOwner). A group or unclaimed actor has no profile
 * and falls back to its own display_name and slug.
 */
export async function actorNames(
  supabase: AnySupabaseClient,
  actorIds: string[]
): Promise<Map<string, ActorName>> {
  const names = new Map<string, ActorName>();
  if (actorIds.length === 0) {
    return names;
  }
  const { data: actors } = (await fromTable(supabase, DATABASE_TABLES.ACTORS)
    .select('id, user_id, display_name, slug')
    .in('id', actorIds)) as {
    data: Array<{
      id: string;
      user_id: string | null;
      display_name: string | null;
      slug: string | null;
    }> | null;
  };
  const userIds = (actors ?? []).map(a => a.user_id).filter((id): id is string => Boolean(id));
  const { data: profiles } = userIds.length
    ? ((await fromTable(supabase, DATABASE_TABLES.PROFILES)
        .select('id, username, name')
        .in('id', userIds)) as {
        data: Array<{ id: string; username: string | null; name: string | null }> | null;
      })
    : { data: [] };
  const byUser = new Map((profiles ?? []).map(p => [p.id, p]));
  for (const actor of actors ?? []) {
    const profile = actor.user_id ? byUser.get(actor.user_id) : undefined;
    names.set(actor.id, {
      actor_id: actor.id,
      name: profile?.name ?? actor.display_name ?? null,
      username: profile?.username ?? actor.slug ?? null,
    });
  }
  return names;
}

/** The name for one actor, or an anonymous placeholder when it could not be read. */
export function nameOf(names: Map<string, ActorName>, actorId: string): ActorName {
  return names.get(actorId) ?? { actor_id: actorId, name: null, username: null };
}

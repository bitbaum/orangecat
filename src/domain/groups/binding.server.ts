/**
 * What another product needs to bind itself to one of our organisations:
 * who it is, what kind of body, where it belongs, and which ACTOR owns it.
 *
 * Solon founds an organization "for" an OrangeCat group only when the founder's
 * OrangeCat actor is this owner, so the two records describe one body by
 * proof rather than by a shared name. Public groups only: a private group's
 * name, kind and place are not ours to publish, binding or not.
 */
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { lookupUserActor } from '@/domain/actors';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export interface GroupBinding {
  id: string;
  slug: string;
  name: string;
  /** The collective kind (groups.label) — one of @bitbaum/collective-kinds' ids. */
  label: string;
  place: { country_code: string; region: string; locality: string } | null;
  owner_actor_id: string;
}

interface GroupRow {
  id: string;
  slug: string;
  name: string;
  label: string;
  is_public: boolean | null;
  country_code: string | null;
  region: string | null;
  locality: string | null;
  created_by: string;
}

/** Pure: the row plus the owner's actor, shaped for the wire. */
export function toBinding(row: GroupRow, ownerActorId: string): GroupBinding {
  const place =
    row.country_code && row.region && row.locality
      ? { country_code: row.country_code, region: row.region, locality: row.locality }
      : null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    label: row.label,
    place,
    owner_actor_id: ownerActorId,
  };
}

/** Null when there is no such public group, or its owner has no actor. */
export async function getGroupBinding(
  supabase: AnySupabaseClient,
  slug: string
): Promise<GroupBinding | null> {
  const { data } = await supabase
    .from(ENTITY_REGISTRY.group.tableName)
    .select('id, slug, name, label, is_public, country_code, region, locality, created_by')
    .eq('slug', slug)
    .eq('is_public', true)
    .maybeSingle();
  if (!data) {
    return null;
  }
  const row = data as GroupRow;
  const { actorId } = await lookupUserActor(supabase, row.created_by);
  return actorId ? toBinding(row, actorId) : null;
}

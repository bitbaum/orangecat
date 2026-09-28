/**
 * My things — everything this person made or joined, as one list.
 *
 * Fifteen dashboards each know their own rows; nothing knew all of them, so
 * the sidebar had to list fifteen doors. This reads every registry type
 * through the registry (table, owner column, title column, detail path), plus
 * the organisations the person belongs to but did not create, and returns one
 * shape. No HTTP, no JSX: the page and the Cat both call it.
 */
import { DATABASE_TABLES } from '@/config/database-tables';
import { ENTITY_REGISTRY, ENTITY_TYPES, type EntityType } from '@/config/entity-registry';
import { INTENT_LIST, type Intent } from '@/config/intents';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export interface Thing {
  type: EntityType;
  id: string;
  title: string;
  /** The raw status word; render it through getStatusInfo(status, type). */
  status: string | null;
  createdAt: string | null;
  /** Where it opens for its owner: the type's detail page, else its list. */
  href: string;
  /** True when the person is a member rather than the creator (organisations). */
  joined?: boolean;
}

export interface ThingsByIntent {
  intent: Intent;
  things: Thing[];
}

const MAX_PER_TYPE = 50;
const UNTITLED = '(untitled)';

type Row = Record<string, unknown>;

function hrefFor(type: EntityType, row: Row): string {
  const meta = ENTITY_REGISTRY[type];
  const key = row[meta.detailKeyColumn ?? 'id'];
  return meta.detailPath && typeof key === 'string' ? meta.detailPath(key) : meta.basePath;
}

function toThing(type: EntityType, row: Row, joined = false): Thing {
  const meta = ENTITY_REGISTRY[type];
  const titleCol = meta.titleColumn ?? 'title';
  return {
    type,
    id: String(row.id),
    title: String(row[titleCol] ?? UNTITLED),
    status: typeof row.status === 'string' ? row.status : null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
    href: hrefFor(type, row),
    joined,
  };
}

function columnsFor(type: EntityType, withStatus: boolean): string {
  const meta = ENTITY_REGISTRY[type];
  const cols = new Set(['id', meta.titleColumn ?? 'title', 'created_at']);
  if (meta.detailKeyColumn) {
    cols.add(meta.detailKeyColumn);
  }
  if (withStatus) {
    cols.add('status');
  }
  return [...cols].join(', ');
}

async function actorIdsOf(supabase: AnySupabaseClient, userId: string): Promise<string[]> {
  const { data } = await supabase.from(DATABASE_TABLES.ACTORS).select('id').eq('user_id', userId);
  return (data ?? []).map((a: { id: string }) => a.id);
}

/**
 * Rows of one type the person owns. Retries without `status` for tables that
 * have none (organisations), so one missing column cannot blank the list.
 */
async function ownedRows(
  supabase: AnySupabaseClient,
  type: EntityType,
  userId: string,
  actorIds: string[]
): Promise<Row[]> {
  const meta = ENTITY_REGISTRY[type];
  const run = (withStatus: boolean) => {
    let q = supabase
      .from(meta.tableName)
      .select(columnsFor(type, withStatus))
      .order('created_at', { ascending: false })
      .limit(MAX_PER_TYPE);
    q =
      meta.userIdField === 'actor_id' ? q.in('actor_id', actorIds) : q.eq(meta.userIdField, userId);
    return q;
  };
  if (meta.userIdField === 'actor_id' && actorIds.length === 0) {
    return [];
  }
  let { data, error } = await run(true);
  if (error) {
    ({ data, error } = await run(false));
  }
  return error || !data ? [] : (data as unknown as Row[]);
}

/** Organisations the person is a member of but did not create. */
async function joinedGroups(supabase: AnySupabaseClient, userId: string): Promise<Row[]> {
  const { data: memberships } = await supabase
    .from(DATABASE_TABLES.GROUP_MEMBERS)
    .select('group_id')
    .eq('user_id', userId);
  const ids = (memberships ?? []).map((m: { group_id: string }) => m.group_id);
  if (ids.length === 0) {
    return [];
  }
  const meta = ENTITY_REGISTRY.group;
  const { data } = await supabase
    .from(meta.tableName)
    .select(columnsFor('group', false))
    .in('id', ids)
    .neq(meta.userIdField, userId)
    .order('created_at', { ascending: false })
    .limit(MAX_PER_TYPE);
  return (data ?? []) as unknown as Row[];
}

/** Everything the person made or joined, newest first within each type. */
export async function listMyThings(supabase: AnySupabaseClient, userId: string): Promise<Thing[]> {
  const actorIds = await actorIdsOf(supabase, userId);
  const [owned, joined] = await Promise.all([
    Promise.all(ENTITY_TYPES.map(type => ownedRows(supabase, type, userId, actorIds))),
    joinedGroups(supabase, userId),
  ]);
  const things = ENTITY_TYPES.flatMap((type, i) => owned[i].map(row => toThing(type, row)));
  return [...things, ...joined.map(row => toThing('group', row, true))];
}

/** The same list grouped the way the map groups it — by what the person wanted. */
export function groupThingsByIntent(things: Thing[]): ThingsByIntent[] {
  return INTENT_LIST.map(intent => ({
    intent,
    things: things.filter(t => ENTITY_REGISTRY[t.type].plain.intent === intent.id),
  })).filter(section => section.things.length > 0);
}

/**
 * "Search the people I follow" — the Cat's discovery, scoped to one person's
 * follow graph.
 *
 * search_platform and explore_topic look across everyone. A person who asks
 * "what did people I follow post about Lightning this week?" wants the
 * opposite: a small, trusted circle, recent first. This module answers that
 * from the `follows` edge (the same one follow_user writes), returning timeline
 * posts and entities authored by followed people only.
 *
 * Visibility: PUBLIC ONLY. A followed person's private or followers-only posts
 * and draft entities never appear, even though the follow edge exists — the
 * Cat may quote these results back, and a follow is not a grant of access.
 * Posts must be `visibility = 'public'` and not deleted; entities pass the same
 * per-type public gate discovery uses; test rows are dropped.
 *
 * Bounded: one follows read (capped), one profiles read, one actors read, one
 * posts read and one read per entity type — a constant number of queries no
 * matter how many people are followed.
 *
 * No AI imports: this runs the same way for a free-tier user as for anyone.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import { logger } from '@/utils/logger';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { applyPublicGate } from './discovery-match';
import { ilikeOrConditions, searchTokens } from './search-tokens';

const LOG_SOURCE = 'CatFollowingScope';

/** Who a discovery tool searches: everyone, or only the people the user follows. */
export const SEARCH_SCOPES = ['everyone', 'following'] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number];

/** The model writes words, not enums — "following", "follows", "my network" all mean the same. */
export function isFollowingScope(scope: unknown): boolean {
  return (
    typeof scope === 'string' &&
    /^(following|follows?|followed|my[ _-]?network)$/i.test(scope.trim())
  );
}

/** Followed people considered per search. Beyond this the oldest follows drop. */
export const MAX_FOLLOWED_SCANNED = 500;
const MAX_POSTS = 10;
const MAX_ENTITIES_PER_TYPE = 4;
const MAX_PEOPLE = 8;
const MAX_DAYS = 365;

/** Public permalink of a timeline post (the /post route). */
export const POST_PATH = '/post';

/** Entity types a followed person's WORK is searched in. */
const FOLLOWING_ENTITY_TYPES: readonly EntityType[] = [
  'project',
  'product',
  'service',
  'cause',
  'event',
  'research',
];

/** search_platform's `type` vocabulary → the entity types it narrows to. */
const SEARCH_TYPE_TO_ENTITIES: Record<string, readonly EntityType[]> = {
  all: FOLLOWING_ENTITY_TYPES,
  projects: ['project'],
  products: ['product'],
  services: ['service'],
  events: ['event'],
  causes: ['cause'],
  people: [],
};

export interface FollowingPerson {
  userId: string;
  username: string | null;
  name: string | null;
  bio: string | null;
}

export interface FollowingPost {
  id: string;
  url: string;
  author: string;
  text: string;
  postedAt: string;
}

export interface FollowingEntity {
  entityType: EntityType;
  id: string;
  title: string;
  description: string | null;
  url: string;
  owner: string;
}

export interface FollowingSearchResult {
  query: string;
  days: number | null;
  /** How many people the user follows (as scanned, capped). 0 = follows nobody. */
  followingCount: number;
  posts: FollowingPost[];
  entities: FollowingEntity[];
  /** Followed people whose name/handle/bio match — only for type 'people'. */
  people: FollowingPerson[];
}

export interface FollowingSearchOptions {
  /** Look-back window in days; omitted = any time (still newest first). */
  days?: number;
  /** search_platform's type ('all', 'projects', 'people', …). */
  searchType?: string;
  /** A single entity type (explore_topic's entityType). Wins over searchType. */
  entityType?: EntityType;
}

/** The ids of everyone this user follows, newest follows first, capped. */
export async function getFollowedUserIds(
  supabase: AnySupabaseClient,
  userId: string,
  limit: number = MAX_FOLLOWED_SCANNED
): Promise<string[]> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.FOLLOWS)
    .select('following_id')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    logger.warn('follows read failed', { error }, LOG_SOURCE);
    throw new Error('Could not read who you follow');
  }
  const ids = ((data ?? []) as Array<{ following_id: string }>)
    .map(r => r.following_id)
    .filter(id => id && id !== userId);
  return [...new Set(ids)];
}

/** A window in days, clamped to [1, 365]; anything unusable means "no window". */
export function normaliseDays(days: unknown): number | null {
  const n = typeof days === 'string' ? Number(days) : days;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
    return null;
  }
  return Math.min(Math.ceil(n), MAX_DAYS);
}

function sinceIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function handleOf(p: FollowingPerson | undefined): string {
  if (!p) {
    return 'someone you follow';
  }
  return p.username ? `@${p.username}` : (p.name ?? 'someone you follow');
}

/** Timeline posts by followed people, newest first. */
async function searchPosts(
  supabase: AnySupabaseClient,
  authorIds: string[],
  tokens: string[],
  since: string | null
): Promise<
  Array<{
    id: string;
    actor_id: string;
    title: string | null;
    description: string | null;
    event_timestamp: string;
  }>
> {
  let q = supabase
    .from(DATABASE_TABLES.TIMELINE_EVENTS)
    .select('id, actor_id, title, description, event_timestamp')
    .in('actor_id', authorIds)
    .eq('visibility', 'public')
    .eq('is_deleted', false);
  if (since) {
    q = q.gte('event_timestamp', since);
  }
  if (tokens.length > 0) {
    q = q.or(ilikeOrConditions(['title', 'description'], tokens));
  }
  const { data, error } = await q.order('event_timestamp', { ascending: false }).limit(MAX_POSTS);
  if (error) {
    logger.warn('following posts read failed', { error }, LOG_SOURCE);
    return [];
  }
  return (data ?? []) as Array<{
    id: string;
    actor_id: string;
    title: string | null;
    description: string | null;
    event_timestamp: string;
  }>;
}

/** Public entities of one type owned by followed people's actors. */
async function searchEntitiesOfType(
  supabase: AnySupabaseClient,
  type: EntityType,
  actorIds: string[],
  tokens: string[],
  since: string | null
): Promise<Array<Record<string, unknown>>> {
  const meta = ENTITY_REGISTRY[type];
  const titleCol = meta.titleColumn ?? 'title';
  try {
    let q = supabase
      .from(meta.tableName)
      .select(`id, ${titleCol}, description, actor_id, is_test, created_at`)
      .in('actor_id', actorIds);
    q = applyPublicGate(q, type) as typeof q;
    if (since) {
      q = q.gte('created_at', since);
    }
    if (tokens.length > 0) {
      q = q.or(ilikeOrConditions([titleCol, 'description'], tokens));
    }
    const { data, error } = await q
      .order('created_at', { ascending: false })
      .limit(MAX_ENTITIES_PER_TYPE);
    if (error) {
      logger.warn('following entities read failed', { error, type }, LOG_SOURCE);
      return [];
    }
    return ((data ?? []) as unknown as Array<Record<string, unknown>>).filter(
      r => r.is_test !== true
    );
  } catch (err) {
    logger.warn('following entities read threw', { err, type }, LOG_SOURCE);
    return [];
  }
}

/**
 * Search what the people a user follows have published. An empty query means
 * "everything they posted" (within the window) — "what did people I follow
 * post this week?" has no keyword.
 */
export async function searchFollowing(
  supabase: AnySupabaseClient,
  userId: string,
  query: string,
  opts: FollowingSearchOptions = {}
): Promise<FollowingSearchResult> {
  const days = normaliseDays(opts.days);
  const base: FollowingSearchResult = {
    query: query.trim(),
    days,
    followingCount: 0,
    posts: [],
    entities: [],
    people: [],
  };

  const followed = await getFollowedUserIds(supabase, userId);
  if (followed.length === 0) {
    return base;
  }
  base.followingCount = followed.length;

  const tokens = query.trim() ? searchTokens(query) : [];
  const since = days ? sinceIso(days) : null;
  const entityTypes = opts.entityType
    ? FOLLOWING_ENTITY_TYPES.includes(opts.entityType)
      ? [opts.entityType]
      : []
    : (SEARCH_TYPE_TO_ENTITIES[opts.searchType ?? 'all'] ?? FOLLOWING_ENTITY_TYPES);
  const wantsPosts = !opts.entityType && (opts.searchType ?? 'all') === 'all';
  const wantsPeople = opts.searchType === 'people';

  const [profilesRes, actorsRes, postRows] = await Promise.all([
    supabase.from(DATABASE_TABLES.PROFILES).select('id, username, name, bio').in('id', followed),
    entityTypes.length > 0
      ? supabase.from(DATABASE_TABLES.ACTORS).select('id, user_id').in('user_id', followed)
      : Promise.resolve({ data: [] as unknown[] }),
    wantsPosts ? searchPosts(supabase, followed, tokens, since) : Promise.resolve([]),
  ]);

  const people = new Map<string, FollowingPerson>();
  for (const p of (profilesRes.data ?? []) as Array<{
    id: string;
    username: string | null;
    name: string | null;
    bio: string | null;
  }>) {
    people.set(p.id, { userId: p.id, username: p.username, name: p.name, bio: p.bio });
  }

  base.posts = postRows.map(r => ({
    id: r.id,
    url: `${POST_PATH}/${r.id}`,
    author: handleOf(people.get(r.actor_id)),
    text: [r.title, r.description].filter(Boolean).join(' — ').slice(0, 280),
    postedAt: r.event_timestamp,
  }));

  const actorOwner = new Map<string, string>();
  for (const a of (actorsRes.data ?? []) as Array<{ id: string; user_id: string | null }>) {
    if (a.user_id) {
      actorOwner.set(a.id, a.user_id);
    }
  }
  const actorIds = [...actorOwner.keys()];
  if (actorIds.length > 0 && entityTypes.length > 0) {
    const perType = await Promise.all(
      entityTypes.map(type => searchEntitiesOfType(supabase, type, actorIds, tokens, since))
    );
    perType.forEach((rows, i) => {
      const type = entityTypes[i];
      const meta = ENTITY_REGISTRY[type];
      const titleCol = meta.titleColumn ?? 'title';
      for (const r of rows) {
        const id = String(r.id);
        base.entities.push({
          entityType: type,
          id,
          title: String(r[titleCol] ?? '(untitled)'),
          description: typeof r.description === 'string' ? r.description.slice(0, 200) : null,
          url: `${meta.publicBasePath}/${id}`,
          owner: handleOf(people.get(actorOwner.get(String(r.actor_id)) ?? '')),
        });
      }
    });
  }

  if (wantsPeople) {
    base.people = [...people.values()]
      .filter(p => {
        if (tokens.length === 0) {
          return true;
        }
        const hay = [p.username, p.name, p.bio].filter(Boolean).join(' ').toLowerCase();
        return tokens.some(t => hay.includes(t));
      })
      .slice(0, MAX_PEOPLE);
  }

  return base;
}

/** Plain-text digest for the model — what to say, and what never to invent. */
export function formatFollowingForModel(r: FollowingSearchResult): string {
  const about = r.query ? ` about "${r.query}"` : '';
  const window = r.days ? ` in the last ${r.days} day${r.days === 1 ? '' : 's'}` : '';
  if (r.followingCount === 0) {
    return (
      'SCOPE: people the user follows. The user does not follow anyone yet, so there is nothing ' +
      'to search in that scope. Say so plainly; offer to search all of OrangeCat instead, or to ' +
      'follow people they find interesting (follow_user). Never invent posts or people.'
    );
  }
  const lines: string[] = [
    `SCOPE: public posts and listings by the ${r.followingCount} people the user follows${about}${window}. Nothing private is included.`,
  ];
  if (r.posts.length > 0) {
    lines.push('', 'POSTS (newest first):');
    for (const p of r.posts) {
      lines.push(`- ${p.author} on ${p.postedAt.slice(0, 10)}: "${p.text}" (${p.url})`);
    }
  }
  if (r.entities.length > 0) {
    lines.push('', 'THEIR LISTINGS:');
    for (const e of r.entities) {
      lines.push(
        `- ${e.entityType} "${e.title}" by ${e.owner} (${e.url})${e.description ? ` — ${e.description}` : ''}`
      );
    }
  }
  if (r.people.length > 0) {
    lines.push('', 'PEOPLE YOU FOLLOW WHO MATCH:');
    for (const p of r.people) {
      const handle = p.username ? `@${p.username}` : (p.name ?? 'someone');
      lines.push(
        `- ${handle}${p.name && p.username ? ` (${p.name})` : ''}${p.bio ? ` — ${p.bio.slice(0, 140)}` : ''}`
      );
    }
  }
  if (r.posts.length + r.entities.length + r.people.length === 0) {
    lines.push(
      '',
      `Nothing matched${about}${window} among the people they follow. Say so honestly — do NOT ` +
        'claim nobody on OrangeCat covers it (only their follows were searched). Offer to search ' +
        'everyone, or to set a following_topic watch (create_watch) so they hear when someone they follow posts about it.'
    );
  } else {
    lines.push(
      '',
      'Summarise this for the user: who said what, linking each post or listing. Quote only what is above — never invent posts, dates or people.'
    );
  }
  return lines.join('\n');
}

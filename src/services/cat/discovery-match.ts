/**
 * Topic discovery from a vector the caller already holds — the half of
 * ./discovery that never calls the embedding provider.
 *
 * Split out so a background job can match a topic without spending a key: the
 * cat-watches timer reads the vector stored when the user created the watch
 * and calls exploreTopicByVector, and this file importing nothing from
 * @/services/ai is what __tests__/unit/no-background-ai.test.ts holds it to.
 * Design notes (people found through work, public-only) live in ./discovery.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { ENTITY_REGISTRY, isValidEntityType, type EntityType } from '@/config/entity-registry';
import { logger } from '@/utils/logger';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { DiscoveryHit, DiscoveryPerson, DiscoveryResult } from './discovery-types';

const LOG_SOURCE = 'CatDiscovery';

/** Pull generously from the index, then filter/rank down — recall first. */
const MATCH_COUNT = 40;
/** Below this a hit is topically unrelated (match_content default is 0.35). */
const MIN_SIMILARITY = 0.3;
/** Cap what reaches the model, so the digest stays readable. */
const MAX_ENTITIES_RETURNED = 12;
const MAX_PEOPLE_RETURNED = 8;
/** Above this two phrasings mean the same interest ("longevity" ~ "long life"). */
const PEOPLE_MIN_SIMILARITY = 0.45;
const PEOPLE_MATCH_COUNT = 8;

interface MatchRow {
  entity_type: string;
  entity_id: string;
  title: string | null;
  url: string | null;
  text_preview: string | null;
  similarity: number;
}

/**
 * Public-visibility predicate per type, applied when we re-read the row to
 * enrich it. The index can lag a row going private, so this is the gate that
 * actually decides what a user sees.
 */
function applyPublicGate(query: unknown, type: EntityType): unknown {
  const q = query as {
    eq: (c: string, v: unknown) => unknown;
    in: (c: string, v: unknown[]) => unknown;
  };
  switch (type) {
    case 'wishlist':
      return (q.eq('visibility', 'public') as typeof q).eq('is_active', true);
    case 'circle':
      return (q.eq('visibility', 'public') as typeof q).eq('status', 'active');
    case 'group':
      return q.eq('is_public', true);
    case 'research':
    case 'ai_assistant':
    case 'loan':
      return (q.eq('is_public', true) as typeof q).eq('status', 'active');
    case 'investment':
      return q.eq('is_public', true);
    case 'event':
      return q.in('status', ['published', 'open', 'ongoing']);
    default:
      return q.eq('status', 'active');
  }
}

/** Resolve the human behind an entity: actor → profile. */
async function resolveOwner(
  supabase: AnySupabaseClient,
  actorId: string | null,
  ownerUserId: string | null
): Promise<DiscoveryPerson | null> {
  try {
    let userId = ownerUserId;
    let displayName: string | null = null;

    if (actorId) {
      const { data: actor } = await supabase
        .from(DATABASE_TABLES.ACTORS)
        .select('user_id, display_name')
        .eq('id', actorId)
        .maybeSingle();
      const a = actor as { user_id: string | null; display_name: string | null } | null;
      userId = userId ?? a?.user_id ?? null;
      displayName = a?.display_name ?? null;
    }
    if (!userId) {
      return displayName
        ? { userId: null, displayName, username: null, profileUrl: null, via: [] }
        : null;
    }

    const { data: profile } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('username, name')
      .eq('id', userId)
      .maybeSingle();
    const p = profile as { username: string | null; name: string | null } | null;
    const username = p?.username ?? null;
    return {
      userId,
      displayName: p?.name || displayName || username || 'Someone',
      username,
      profileUrl: username ? `/profiles/${username}` : null,
      via: [],
    };
  } catch {
    return null;
  }
}

/** Re-read a matched row so the card has live, public, owner-attributed data. */
async function enrichHit(supabase: AnySupabaseClient, row: MatchRow): Promise<DiscoveryHit | null> {
  if (!isValidEntityType(row.entity_type)) {
    return null;
  }
  const type = row.entity_type as EntityType;
  const meta = ENTITY_REGISTRY[type];
  const titleCol = meta.titleColumn ?? 'title';

  try {
    let q = supabase
      .from(meta.tableName)
      .select(`id, ${titleCol}, description, actor_id, user_id, is_test`)
      .eq('id', row.entity_id);
    q = applyPublicGate(q, type) as typeof q;
    const { data, error } = await (
      q as unknown as { maybeSingle: () => Promise<{ data: unknown; error: unknown }> }
    ).maybeSingle();
    if (error || !data) {
      // Row is gone or no longer public — the index lagged. Drop it.
      return null;
    }
    const rec = data as Record<string, unknown>;
    // Never surface rows created by test API keys on a discovery surface.
    if (rec.is_test === true) {
      return null;
    }

    const owner = await resolveOwner(
      supabase,
      typeof rec.actor_id === 'string' ? rec.actor_id : null,
      typeof rec.user_id === 'string' ? rec.user_id : null
    );

    return {
      entityType: type,
      entityId: row.entity_id,
      title: String(rec[titleCol] ?? row.title ?? '(untitled)'),
      description:
        typeof rec.description === 'string' && rec.description
          ? rec.description.slice(0, 300)
          : (row.text_preview ?? null),
      url: row.url ?? `${meta.publicBasePath}/${row.entity_id}`,
      similarity: row.similarity,
      owner,
    };
  } catch (err) {
    logger.warn('discovery enrich failed', { err, type }, LOG_SOURCE);
    return null;
  }
}

/** A profile that matched directly (has a bio) — kept as a bonus signal. */
function personFromProfileRow(row: MatchRow): DiscoveryPerson | null {
  const username = row.url?.startsWith('/profiles/') ? row.url.slice('/profiles/'.length) : null;
  if (!username) {
    return null;
  }
  return {
    userId: row.entity_id,
    displayName: row.title || username,
    username,
    profileUrl: row.url,
    via: row.text_preview ? [row.text_preview.slice(0, 140)] : [],
  };
}

/**
 * People who declared an interest close to this vector. This is what lets
 * someone be found on day one, before they have published anything at all.
 */
export async function findPeopleByInterestVector(
  supabase: AnySupabaseClient,
  viewerUserId: string,
  vec: number[]
): Promise<DiscoveryPerson[]> {
  try {
    const { data, error } = await supabase.rpc('match_interested_people', {
      query_embedding: JSON.stringify(vec),
      exclude_user: viewerUserId,
      match_count: PEOPLE_MATCH_COUNT,
      min_similarity: PEOPLE_MIN_SIMILARITY,
    });
    if (error || !data) {
      logger.warn('match_interested_people failed', { error }, LOG_SOURCE);
      return [];
    }

    const rows = data as { user_id: string; topic: string }[];
    if (rows.length === 0) {
      return [];
    }

    const { data: profiles } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('id, username, name')
      .in(
        'id',
        rows.map(r => r.user_id)
      );
    type ProfileRow = { id: string; username: string | null; name: string | null };
    const byId = new Map<string, ProfileRow>(
      ((profiles ?? []) as ProfileRow[]).map(p => [p.id, p] as const)
    );

    const people: DiscoveryPerson[] = [];
    for (const r of rows) {
      const p = byId.get(r.user_id);
      // No readable profile → a name-less ghost. Drop it rather than show it.
      if (!p) {
        continue;
      }
      people.push({
        userId: r.user_id,
        displayName: p.name || p.username || 'Someone',
        username: p.username,
        profileUrl: p.username ? `/profiles/${p.username}` : null,
        via: [`Interested in ${r.topic}`],
      });
    }
    return people;
  } catch (err) {
    logger.warn('findPeopleByInterest threw', { err }, LOG_SOURCE);
    return [];
  }
}

/**
 * Find everything on the platform related to a topic, plus the people behind
 * it, from a vector the caller already has. Returns `degraded: true` (never
 * throws) when the semantic index is unavailable, so the caller can say so
 * honestly instead of implying the platform is empty.
 */
export async function exploreTopicByVector(
  supabase: AnySupabaseClient,
  viewerUserId: string,
  topic: string,
  vec: number[],
  opts: { entityType?: EntityType } = {}
): Promise<DiscoveryResult> {
  const empty: DiscoveryResult = { topic, hits: [], people: [], degraded: false };
  if (!topic.trim()) {
    return empty;
  }

  let rows: MatchRow[] = [];
  // People who *declared* this interest. Resolved from the same vector as the
  // entity search, and independent of it: the index being empty for a topic
  // says nothing about who cares about it.
  let interestPeople: DiscoveryPerson[] = [];
  try {
    interestPeople = await findPeopleByInterestVector(supabase, viewerUserId, vec);
    const { data, error } = await supabase.rpc('match_content', {
      query_embedding: JSON.stringify(vec),
      match_count: MATCH_COUNT,
      filter_type: opts.entityType ?? null,
      min_similarity: MIN_SIMILARITY,
    });
    if (error) {
      logger.warn('match_content failed', { error }, LOG_SOURCE);
      // Entity index down, but people who declared the interest still count —
      // hand back what we do have rather than nothing.
      return { ...empty, people: interestPeople, degraded: true };
    }
    rows = (data ?? []) as MatchRow[];
  } catch (err) {
    logger.warn('exploreTopic threw', { err }, LOG_SOURCE);
    return { ...empty, people: interestPeople, degraded: true };
  }

  // Profiles that matched on their own text are people directly; everything
  // else is an entity whose owner we resolve below.
  const peopleByUser = new Map<string, DiscoveryPerson>();
  for (const r of rows.filter(r => r.entity_type === 'profile')) {
    const person = personFromProfileRow(r);
    if (person && person.userId !== viewerUserId) {
      peopleByUser.set(person.userId!, person);
    }
  }

  const entityRows = rows.filter(r => r.entity_type !== 'profile');
  const enriched = (await Promise.all(entityRows.map(r => enrichHit(supabase, r)))).filter(
    (h): h is DiscoveryHit => h !== null
  );

  // The user's own entities aren't a discovery — exclude them.
  const hits = enriched
    .filter(h => h.owner?.userId !== viewerUserId)
    .slice(0, MAX_ENTITIES_RETURNED);

  // Aggregate owners: this is how people become discoverable without bios.
  for (const h of hits) {
    const o = h.owner;
    if (!o?.userId) {
      continue;
    }
    const existing = peopleByUser.get(o.userId);
    const via = `${ENTITY_REGISTRY[h.entityType].name}: ${h.title}`;
    if (existing) {
      if (existing.via.length < 3) {
        existing.via.push(via);
      }
    } else {
      peopleByUser.set(o.userId, { ...o, via: [via] });
    }
  }

  // Someone can arrive by both channels — published work AND a declared
  // interest. Keep both reasons; that combination is the strongest signal
  // there is, so those people sort first.
  for (const p of interestPeople) {
    if (!p.userId) {
      continue;
    }
    const existing = peopleByUser.get(p.userId);
    if (existing) {
      existing.via = [...p.via, ...existing.via].slice(0, 3);
    } else {
      peopleByUser.set(p.userId, p);
    }
  }
  const interestUserIds = new Set(interestPeople.map(p => p.userId));
  const people = [...peopleByUser.values()].sort((a, b) => {
    const score = (p: DiscoveryPerson) =>
      (interestUserIds.has(p.userId) ? 2 : 0) + (p.via.length > 1 ? 1 : 0);
    return score(b) - score(a);
  });

  return {
    topic,
    hits,
    people: people.slice(0, MAX_PEOPLE_RETURNED),
    degraded: false,
  };
}

/** Render a discovery result as the compact prose digest the model reads. */
export function formatDiscoveryForModel(result: DiscoveryResult): string {
  if (result.degraded) {
    return `TOPIC SEARCH UNAVAILABLE for "${result.topic}" — the semantic index could not be reached. Tell the user honestly that you could not search right now; do NOT claim the platform has nothing on this topic.`;
  }
  if (result.hits.length === 0 && result.people.length === 0) {
    return [
      `No public entities or people on OrangeCat match "${result.topic}" yet. Say so plainly — being early is the honest framing, not a failure.`,
      `Then offer BOTH of these, briefly, in one breath:`,
      `1. publish_interest("${result.topic}") — so the next person who searches this finds THEM. Call publish_interest, NOT update_profile: this is a searchable interest, not bio text, so do not offer to edit their bio or background. Say in plain words that the topic becomes visible to anyone signed in, and get a clear yes first; never publish silently.`,
      `2. watch_topic("${result.topic}") — you'll tell them the moment someone shows up.`,
      `Also offer to help them create the first entity in this space if that fits.`,
    ].join('\n');
  }

  const byType = new Map<EntityType, DiscoveryHit[]>();
  for (const h of result.hits) {
    byType.set(h.entityType, [...(byType.get(h.entityType) ?? []), h]);
  }

  const parts: string[] = [`RELATED TO "${result.topic}" ON ORANGECAT (all public):`];
  if (result.hits.length === 0) {
    parts.push(
      `\nNo published entities on this topic yet — but the people below said they are into it, which is exactly who to talk to.`
    );
  }
  for (const [type, hits] of byType) {
    const meta = ENTITY_REGISTRY[type];
    parts.push(`\n${meta.namePlural}:`);
    for (const h of hits) {
      const who = h.owner
        ? ` — by ${h.owner.displayName}${h.owner.username ? ` (@${h.owner.username})` : ''}`
        : '';
      const desc = h.description ? ` :: ${h.description.slice(0, 160)}` : '';
      parts.push(`- "${h.title}"${who} [${h.url}] (relevance ${h.similarity.toFixed(2)})${desc}`);
    }
  }

  if (result.people.length > 0) {
    parts.push(
      `\nPEOPLE into this (offer an introduction — request_introduction takes an entity_id from above; for someone who surfaced only via a declared interest, suggest following them or opening a conversation instead):`
    );
    for (const p of result.people) {
      const handle = p.username ? `@${p.username}` : p.displayName;
      parts.push(
        `- ${p.displayName} (${handle})${p.via.length > 0 ? ` — ${p.via.join('; ')}` : ''}`
      );
    }
  }

  parts.push(
    `\nPresent this as a short guided tour, not a list dump: group by what it IS, say in one clause WHY each is relevant to their interest, and link the titles. Then offer the concrete next step — following someone, or an introduction (request_introduction) to the person whose work fits best. Never invent entities or people beyond this list.`
  );
  return parts.join('\n');
}

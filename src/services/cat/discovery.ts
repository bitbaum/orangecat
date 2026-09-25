/**
 * Cat topic discovery — "I'm interested in longevity" → what exists here, and
 * WHO is behind it.
 *
 * Two design decisions worth knowing:
 *
 * 1. People are found through their WORK, not their bios. Only a handful of
 *    profiles carry any bio text, so a bio-only people search finds almost
 *    nobody. Instead we match entities semantically and then aggregate the
 *    owners behind the hits — someone into longevity is discoverable through
 *    the research they published, which is also the stronger signal.
 *
 *    Published interests are the second channel, and they cover the case work
 *    cannot: someone who has shipped nothing yet but said what they care about
 *    is still findable from day one. Both channels merge into one person list,
 *    each carrying its own `via` reason.
 *
 * 2. Everything surfaced here is PUBLIC. Each type's public predicate mirrors
 *    the discover/search SSOT (see fetchDiscoverCounts + the public-surface
 *    filtering contract test); test rows are excluded. This service runs with
 *    the caller's client, so RLS is the backstop, not the only gate.
 */

import type { EntityType } from '@/config/entity-registry';
import { embeddingsEnabled, embedText } from '@/services/ai/embeddings';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { exploreTopicByVector } from './discovery-match';
import type { DiscoveryHit, DiscoveryPerson, DiscoveryResult } from './discovery-types';

export type { DiscoveryHit, DiscoveryPerson, DiscoveryResult };
export { formatDiscoveryForModel } from './discovery-match';

/**
 * Find everything on the platform related to a topic, plus the people behind
 * it. Embeds the topic — so only a person's request may call this (the Cat's
 * explore_topic tool). Returns `degraded: true` (never throws) when the
 * semantic index is unavailable.
 */
export async function exploreTopic(
  supabase: AnySupabaseClient,
  viewerUserId: string,
  topic: string,
  opts: { entityType?: EntityType } = {}
): Promise<DiscoveryResult> {
  const empty: DiscoveryResult = { topic, hits: [], people: [], degraded: false };
  if (!topic.trim()) {
    return empty;
  }
  if (!embeddingsEnabled()) {
    return { ...empty, degraded: true };
  }
  let vec: number[] | null = null;
  try {
    vec = await embedText(topic);
  } catch {
    vec = null;
  }
  if (!vec) {
    return { ...empty, degraded: true };
  }
  return exploreTopicByVector(supabase, viewerUserId, topic, vec, opts);
}

/**
 * Open peer review of research — shape, reads and the one write.
 *
 * Reviews are append-only (DB trigger research_reviews_are_append_only) and a
 * researcher cannot review their own work (insert policy). Both live in the
 * database so no route can forget them; this module states them again only so
 * the API can say why in words instead of surfacing a policy error.
 */

import { z } from 'zod';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getTableName } from '@/config/entity-registry';
import { REVIEW_LIMITS, REVIEW_VERDICT_VALUES, type ReviewVerdict } from '@/config/open-science';
import { fromTable } from '@/lib/supabase/untyped';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { isAllowedOutputLink, sha256Hex } from './openScience';

export const reviewInputSchema = z.object({
  verdict: z.enum(REVIEW_VERDICT_VALUES),
  body: z
    .string()
    .trim()
    .min(
      REVIEW_LIMITS.MIN_BODY_LENGTH,
      `Say what you checked and what you found — at least ${REVIEW_LIMITS.MIN_BODY_LENGTH} characters.`
    )
    .max(REVIEW_LIMITS.MAX_BODY_LENGTH),
  // '' from an untouched select means "the project as a whole".
  output_link: z.preprocess(
    v => (v === '' ? null : v),
    z
      .string()
      .trim()
      .refine(isAllowedOutputLink, { message: 'Not a link this research lists' })
      .nullable()
      .optional()
  ),
});

export type ReviewInput = z.infer<typeof reviewInputSchema>;

export interface ResearchReview {
  id: string;
  verdict: ReviewVerdict;
  body: string;
  body_sha256: string;
  output_link: string | null;
  created_at: string;
  reviewer: { actor_id: string; name: string | null; username: string | null };
}

interface ReviewRow {
  id: string;
  reviewer_actor_id: string;
  verdict: ReviewVerdict;
  body: string;
  body_sha256: string;
  output_link: string | null;
  created_at: string;
}

const REVIEW_COLUMNS = 'id, reviewer_actor_id, verdict, body, body_sha256, output_link, created_at';

/**
 * Names for a set of reviewer actors. Two queries, not an embed: the live DB
 * has no FK from actors.user_id to profiles (see fetchEntityOwner).
 */
async function reviewerNames(
  supabase: AnySupabaseClient,
  actorIds: string[]
): Promise<Map<string, ResearchReview['reviewer']>> {
  const names = new Map<string, ResearchReview['reviewer']>();
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

/** Reviews of one research entity, newest first, with the total count. RLS decides visibility. */
export async function listResearchReviews(
  supabase: AnySupabaseClient,
  researchId: string
): Promise<{ reviews: ResearchReview[]; total: number }> {
  const { data, error, count } = (await fromTable(supabase, DATABASE_TABLES.RESEARCH_REVIEWS)
    .select(REVIEW_COLUMNS, { count: 'exact' })
    .eq('research_entity_id', researchId)
    .order('created_at', { ascending: false })
    .limit(REVIEW_LIMITS.PAGE_SIZE)) as {
    data: ReviewRow[] | null;
    error: unknown;
    count: number | null;
  };
  if (error) {
    throw error;
  }
  const rows = data ?? [];
  const names = await reviewerNames(supabase, [...new Set(rows.map(r => r.reviewer_actor_id))]);
  return {
    total: count ?? rows.length,
    reviews: rows.map(row => ({
      id: row.id,
      verdict: row.verdict,
      body: row.body,
      body_sha256: row.body_sha256,
      output_link: row.output_link,
      created_at: row.created_at,
      reviewer: names.get(row.reviewer_actor_id) ?? {
        actor_id: row.reviewer_actor_id,
        name: null,
        username: null,
      },
    })),
  };
}

export type CreateReviewResult =
  | { ok: true; review: { id: string; body_sha256: string; created_at: string } }
  | { ok: false; code: 'not_found' | 'forbidden' | 'bad_request'; message: string };

/** Post a review as `reviewerActorId`. */
export async function createResearchReview(
  supabase: AnySupabaseClient,
  researchId: string,
  userId: string,
  reviewerActorId: string,
  input: ReviewInput
): Promise<CreateReviewResult> {
  const { data: research } = (await fromTable(supabase, getTableName('research'))
    .select('id, user_id, is_public, output_links')
    .eq('id', researchId)
    .maybeSingle()) as {
    data: { id: string; user_id: string; is_public: boolean; output_links: string[] | null } | null;
  };
  if (!research || !research.is_public) {
    return { ok: false, code: 'not_found', message: 'Research not found' };
  }
  if (research.user_id === userId) {
    return {
      ok: false,
      code: 'forbidden',
      message:
        'You cannot review your own research. Post a progress update instead, and invite someone else to review it.',
    };
  }
  const outputLink = input.output_link ?? null;
  if (outputLink && !(research.output_links ?? []).includes(outputLink)) {
    return {
      ok: false,
      code: 'bad_request',
      message: 'Pick one of the outputs this research lists, or review the project as a whole.',
    };
  }

  const { data, error } = (await fromTable(supabase, DATABASE_TABLES.RESEARCH_REVIEWS)
    .insert({
      research_entity_id: researchId,
      reviewer_actor_id: reviewerActorId,
      verdict: input.verdict,
      body: input.body,
      body_sha256: await sha256Hex(input.body),
      output_link: outputLink,
    })
    .select('id, body_sha256, created_at')
    .single()) as {
    data: { id: string; body_sha256: string; created_at: string } | null;
    error: unknown;
  };
  if (error || !data) {
    throw error ?? new Error('Review insert returned no row');
  }
  return { ok: true, review: data };
}

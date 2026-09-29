/**
 * Research entity domain logic (server-only).
 *
 * Read-with-relations, owner-gated update, and funding-gated delete for research
 * entities. Kept out of the API route so it stays a thin validate → delegate →
 * respond wrapper. Each function returns a discriminated result the route maps
 * to an HTTP response.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { getTableName } from '@/config/entity-registry';
import { logger } from '@/utils/logger';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import {
  commitPreregistration,
  decidePreregistration,
  PREREGISTRATION_LOCKED_MESSAGE,
} from './openScience';

export type ResearchErrorCode = 'not_found' | 'forbidden';

export type ResearchResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ResearchErrorCode; message: string }
  | { ok: false; dbError: unknown };

interface ResearchOwnerRow {
  user_id: string;
  funding_raised_btc?: number;
  preregistration?: string | null;
  preregistered_at?: string | null;
}

/** Fetch the row's owner (+ optional extra fields); classifies not-found/forbidden. */
async function verifyResearchOwner(
  supabase: AnySupabaseClient,
  id: string,
  userId: string,
  extraFields = ''
): Promise<'not_found' | 'forbidden' | 'error' | ResearchOwnerRow> {
  const result = (await supabase
    .from(getTableName('research'))
    .select(`user_id${extraFields ? ', ' + extraFields : ''}`)
    .eq('id', id)
    .single()) as {
    data: ResearchOwnerRow | null;
    error: { code?: string } | null;
  };
  const { data, error } = result;
  if (error) {
    return error.code === 'PGRST116' ? 'not_found' : 'error';
  }
  if (!data || data.user_id !== userId) {
    return 'forbidden';
  }
  return data;
}

/** Research entity with its progress updates, votes and contributions. */
export async function getResearchWithRelations(
  supabase: AnySupabaseClient,
  id: string,
  viewerId: string | undefined
): Promise<ResearchResult<Record<string, unknown>>> {
  const { data: entity, error } = await supabase
    .from(getTableName('research'))
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    return error.code === 'PGRST116'
      ? { ok: false, code: 'not_found', message: 'Research entity not found' }
      : { ok: false, dbError: error };
  }
  if (!entity.is_public && (!viewerId || viewerId !== entity.user_id)) {
    return { ok: false, code: 'forbidden', message: 'This research entity is private' };
  }

  const [{ data: progressUpdates }, { data: votes }, { data: contributions }] = await Promise.all([
    supabase
      .from(DATABASE_TABLES.RESEARCH_PROGRESS_UPDATES)
      .select('*')
      .eq('research_entity_id', id)
      .order('created_at', { ascending: false }),
    supabase.from(DATABASE_TABLES.RESEARCH_VOTES).select('*').eq('research_entity_id', id),
    supabase
      .from(DATABASE_TABLES.RESEARCH_CONTRIBUTIONS)
      .select('*')
      .eq('research_entity_id', id)
      .order('created_at', { ascending: false }),
  ]);

  return {
    ok: true,
    data: {
      ...entity,
      progress_updates: progressUpdates || [],
      votes: votes || [],
      contributions: contributions || [],
    },
  };
}

/** Update a research entity the user owns. */
export async function updateResearch(
  supabase: AnySupabaseClient,
  id: string,
  userId: string,
  patch: Record<string, unknown>
): Promise<ResearchResult<Record<string, unknown>>> {
  const ownership = await verifyResearchOwner(
    supabase,
    id,
    userId,
    'preregistration, preregistered_at'
  );
  if (ownership === 'not_found') {
    return { ok: false, code: 'not_found', message: 'Research entity not found' };
  }
  if (ownership === 'forbidden') {
    return {
      ok: false,
      code: 'forbidden',
      message: 'You can only update your own research entities',
    };
  }
  if (ownership === 'error') {
    return { ok: false, dbError: new Error('DB error') };
  }

  // The raw text never goes straight to the row: a committed pre-registration
  // is immutable (the DB trigger would reject it anyway), and a first one needs
  // its hash and timestamp written with it.
  const { preregistration, ...rest } = patch;
  const prereg = decidePreregistration(preregistration as string | null | undefined, ownership);
  if (prereg.kind === 'locked') {
    return { ok: false, code: 'forbidden', message: PREREGISTRATION_LOCKED_MESSAGE };
  }
  const writable =
    prereg.kind === 'commit' ? { ...rest, ...(await commitPreregistration(prereg.text)) } : rest;

  const { data: entity, error } = await supabase
    .from(getTableName('research'))
    .update({ ...writable, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    return { ok: false, dbError: error };
  }
  logger.info('Research entity updated', { researchEntityId: id, userId });
  return { ok: true, data: entity };
}

/** Delete a research entity the user owns, unless it already has funding. */
export async function deleteResearch(
  supabase: AnySupabaseClient,
  id: string,
  userId: string
): Promise<ResearchResult<{ deleted: true }>> {
  const ownership = await verifyResearchOwner(supabase, id, userId, 'funding_raised_btc');
  if (ownership === 'not_found') {
    return { ok: false, code: 'not_found', message: 'Research entity not found' };
  }
  if (ownership === 'forbidden') {
    return {
      ok: false,
      code: 'forbidden',
      message: 'You can only delete your own research entities',
    };
  }
  if (ownership === 'error') {
    return { ok: false, dbError: new Error('DB error') };
  }
  if ((ownership.funding_raised_btc ?? 0) > 0) {
    return {
      ok: false,
      code: 'forbidden',
      message: 'Cannot delete research entity with funding. Archive instead.',
    };
  }

  const { error } = await supabase.from(getTableName('research')).delete().eq('id', id);
  if (error) {
    return { ok: false, dbError: error };
  }
  logger.info('Research entity deleted', { researchEntityId: id, userId });
  return { ok: true, data: { deleted: true } };
}

/**
 * Person tags (ADR-0014 D7): how an app that gives every account a say can
 * refuse a second seat to one person, without learning who anyone is.
 *
 * Two accounts get the same tag exactly when one person holds both. The tag is
 * keyed in the database (`identity_person_tags`), per app and per scope, so it
 * says nothing to another app or about another scope, and the key never
 * reaches this process.
 *
 * An account with no tag (not a person's own account, or unknown here) is NOT
 * "a different person": the app must read it as "cannot be told apart".
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { callRpc } from '@/lib/supabase/untyped';
import { logger } from '@/utils/logger';

export const PERSON_TAG_MAX_SUBJECTS = 100;
export const PERSON_TAG_MAX_SCOPE_LENGTH = 200;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PersonTagsResult =
  | { ok: true; tags: Record<string, string> }
  | { ok: false; reason: 'invalid_scope' | 'invalid_subjects' | 'failed' };

/**
 * @param clientId the app asking, already authenticated by the caller.
 * @param scope what the app is deciding within, e.g. one organisation.
 * @param subjects OrangeCat actor ids (the `sub` of each account).
 */
export async function personTagsFor(
  admin: SupabaseClient,
  clientId: string,
  scope: unknown,
  subjects: unknown
): Promise<PersonTagsResult> {
  if (typeof scope !== 'string' || !scope.trim() || scope.length > PERSON_TAG_MAX_SCOPE_LENGTH) {
    return { ok: false, reason: 'invalid_scope' };
  }
  if (
    !Array.isArray(subjects) ||
    subjects.length === 0 ||
    subjects.length > PERSON_TAG_MAX_SUBJECTS ||
    !subjects.every((s): s is string => typeof s === 'string')
  ) {
    return { ok: false, reason: 'invalid_subjects' };
  }
  // An id that is not an actor id has no tag; it is left out, not refused, so
  // an app can pass the ids it holds without sorting them first.
  const actorIds = [...new Set(subjects.filter(s => UUID.test(s)).map(s => s.toLowerCase()))];
  if (actorIds.length === 0) {
    return { ok: true, tags: {} };
  }

  const { data, error } = (await callRpc(admin, 'identity_person_tags', {
    p_client_id: clientId,
    p_scope: scope,
    p_actor_ids: actorIds,
  })) as {
    data: Array<{ actor_id: string; tag: string }> | null;
    error: { message: string } | null;
  };
  if (error) {
    logger.error('Person tags could not be read', { error: error.message, clientId }, 'Identities');
    return { ok: false, reason: 'failed' };
  }
  return { ok: true, tags: Object.fromEntries((data ?? []).map(row => [row.actor_id, row.tag])) };
}

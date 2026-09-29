/**
 * Record that a research entity was published to Nostr — owner only, and only
 * for an event that verifies against this research (see ./nostr).
 */

import { getTableName } from '@/config/entity-registry';
import { fromTable } from '@/lib/supabase/untyped';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';
import { verifyResearchNostrEvent } from './nostr';

export type RecordNostrResult =
  | { ok: true; data: { nostr_event_id: string; nostr_pubkey: string } }
  | { ok: false; code: 'not_found' | 'forbidden' | 'bad_request'; message: string };

export async function recordResearchOnNostr(
  supabase: AnySupabaseClient,
  researchId: string,
  userId: string,
  signedEvent: unknown
): Promise<RecordNostrResult> {
  const table = getTableName('research');
  const { data: research, error } = (await fromTable(supabase, table)
    .select('id, user_id, preregistration_sha256')
    .eq('id', researchId)
    .maybeSingle()) as {
    data: { id: string; user_id: string; preregistration_sha256: string | null } | null;
    error: unknown;
  };
  if (error) {
    throw error;
  }
  if (!research) {
    return { ok: false, code: 'not_found', message: 'Research not found' };
  }
  if (research.user_id !== userId) {
    return {
      ok: false,
      code: 'forbidden',
      message: 'Only the researcher can publish this research to Nostr.',
    };
  }

  const verified = verifyResearchNostrEvent(signedEvent, research);
  if (!verified.ok) {
    return { ok: false, code: 'bad_request', message: verified.reason };
  }

  const record = {
    nostr_event_id: verified.event.id,
    nostr_pubkey: verified.event.pubkey,
    nostr_published_at: new Date(verified.event.created_at * 1000).toISOString(),
  };
  const { error: updateError } = await fromTable(supabase, table)
    .update(record)
    .eq('id', researchId);
  if (updateError) {
    throw updateError;
  }
  logger.info('Research published to Nostr', { researchId, eventId: record.nostr_event_id });
  return { ok: true, data: record };
}

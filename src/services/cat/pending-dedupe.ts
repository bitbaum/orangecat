/**
 * One consent card per identical request.
 *
 * A weak model calls the same action tool twice in one turn — seen live
 * 2026-09-11: two identical "Пекарня Оксаны" cards, and confirming the second
 * would have created a second page for the same person. Same user, same
 * action, same parameters, still pending and unexpired ⇒ the existing card is
 * handed back instead of a new row.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { PendingAction } from './action-types';

/** Order-insensitive equality: the model may serialise keys in any order. */
export function sameParameters(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function findIdenticalPending(
  supabase: AnySupabaseClient,
  userId: string,
  actionId: string,
  parameters: Record<string, unknown>
): Promise<PendingAction | null> {
  const { data } = await supabase
    .from(DATABASE_TABLES.CAT_PENDING_ACTIONS)
    .select('*')
    .eq('user_id', userId)
    .eq('action_id', actionId)
    .eq('status', STATUS.CAT_PENDING_ACTIONS.PENDING)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(5);
  const same = (data ?? []).find(row => sameParameters(row.parameters, parameters));
  if (!same) {
    return null;
  }
  return {
    id: same.id,
    actionId: same.action_id,
    category: same.category,
    parameters: same.parameters,
    description: same.description,
    conversationId: same.conversation_id,
    expiresAt: same.expires_at,
    grantOnConfirm: same.grant_on_confirm === true,
  };
}

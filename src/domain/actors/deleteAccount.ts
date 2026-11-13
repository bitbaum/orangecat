/**
 * Delete an account, and every identity it holds, in one database transaction.
 *
 * `delete_account` (migration 20261112203000) hands over the groups the person
 * founded, unpublishes the pages of a group nobody else is left in, deletes
 * every page the account's actor owns, and deletes the auth.users rows itself.
 * Records shared with other people stay with them, the reference to the person
 * set NULL. If any step fails, nothing is removed.
 */

import { callRpc } from '@/lib/supabase/untyped';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/** Raised by delete_account when an order still ships to one of the account's addresses. */
const UNSHIPPED_ORDERS = 'account_has_unshipped_orders';

export type DeleteAccountResult =
  { ok: true } | { ok: false; reason: 'unshipped_orders' | 'failed'; message: string };

export async function deleteAccount(
  admin: AnySupabaseClient,
  userId: string
): Promise<DeleteAccountResult> {
  const { error } = await callRpc(admin, 'delete_account', { p_user: userId });
  if (!error) {
    return { ok: true };
  }
  const message = String(error.message ?? '');
  return {
    ok: false,
    reason: message.includes(UNSHIPPED_ORDERS) ? 'unshipped_orders' : 'failed',
    message,
  };
}

/**
 * Every page an account's actor owns, deleted in one transaction.
 *
 * Call it before GoTrue deletes the account. The cascade auth.users → profiles
 * → actors reaches eight page tables (projects, products, services, causes,
 * loans, events, research, AI assistants) whose NOT NULL `actor_id` answers
 * with ON DELETE SET NULL, so Postgres refuses the whole delete while one of
 * those pages exists. `delete_account_pages` (migration 20261112203000) removes
 * every row whose `actor_id` is the account's actor first; it is idempotent, so
 * a retry after a failed auth delete finishes the job.
 */

import { callRpc } from '@/lib/supabase/untyped';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/** Returns the database error message, or null when the pages are gone. */
export async function deleteAccountPages(
  admin: AnySupabaseClient,
  userId: string
): Promise<string | null> {
  const { error } = await callRpc(admin, 'delete_account_pages', { p_user: userId });
  return error ? `pages: ${error.message}` : null;
}

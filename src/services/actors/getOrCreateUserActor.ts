/**
 * Get or Create User Actor (Server-Side)
 *
 * Shared utility for ensuring a user has an associated actor record.
 * Uses server-side Supabase clients (createServerClient + createAdminClient).
 *
 * Created: 2026-02-26
 * Last Modified: 2026-02-26
 * Last Modified Summary: Extracted from duplicated code in wishlists and documents services
 */

import { fromTable } from '@/lib/supabase/untyped';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import { lookupUserActor } from '@/domain/actors';

/**
 * Get or create the actor for a user.
 *
 * Creation happens ONLY when the lookup succeeded and found nothing. That
 * distinction is the whole point: this function used to test the PostgREST
 * error code `PGRST116` before creating, and PostgREST returns that same code
 * both for "no rows" and for "too many rows" — so an account that already had
 * several actors read as having none, and this minted another. One account
 * reached six that way. See `lookupUserActor` for the shared query.
 */
export async function getOrCreateUserActor(userId: string): Promise<{ id: string }> {
  const supabase = await createServerClient();
  const adminClient = createAdminClient();

  const found = await lookupUserActor(supabase, userId);

  if (!found.ok) {
    // The lookup itself failed. Creating now would risk a second actor for
    // someone who already has one, and nothing in the schema forbids that.
    throw new Error(`Could not read the actor for user ${userId}`);
  }

  if (found.actorId) {
    return { id: found.actorId };
  }

  // Genuinely no actor — create one using the admin client (bypasses RLS).

  const { data: newActor, error: createError } = await fromTable(
    adminClient,
    DATABASE_TABLES.ACTORS
  )
    .insert({
      actor_type: 'user',
      user_id: userId,
    })
    .select('id')
    .single();

  if (createError) {
    logger.error('Failed to create actor for user', { error: createError.message, userId });
    throw createError;
  }

  logger.info('Created actor for user', { actorId: newActor.id, userId });
  return newActor as { id: string };
}

/**
 * A bot's seat in Messages (ADR-0015, D1–D4).
 *
 * A companion that can be written to like a person is an account, as the Cat
 * is (services/mentions/cat-account.ts): an auth user nobody signs in to, on
 * an address nobody can receive mail at, with a profile carrying the bot's
 * name and face. `companion_seats` says which companion the account speaks
 * for. Its answers are ordinary `messages` rows, so read receipts, replies,
 * reactions, search and realtime work on them without a branch.
 *
 * This file makes a seat and says whether an account is one. It imports no
 * model client, on purpose: the message loaders read it on every GET, and no
 * GET may be able to reach a model (__tests__/unit/ci/no-background-ai). The
 * answering is ./bot-answer.ts.
 */

import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { fromTable } from '@/lib/supabase/untyped';
import { logger } from '@/utils/logger';

/** RFC 2606: nobody can receive mail here, so a seat has no reset channel. */
const SEAT_EMAIL_DOMAIN = 'orangecat.invalid';

export interface BotSeat {
  assistantId: string;
  userId: string;
}

interface CompanionRow {
  id: string;
  user_id: string;
  title: string | null;
  avatar_url: string | null;
}

/**
 * The seats among these accounts: account id → the companion it speaks for,
 * or null when that companion has been deleted (the seat is still a bot's).
 */
export async function seatsOfAccounts(
  admin: SupabaseClient,
  userIds: readonly string[]
): Promise<Map<string, string | null>> {
  const seats = new Map<string, string | null>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) {
    return seats;
  }
  const { data, error } = await fromTable(admin, DATABASE_TABLES.COMPANION_SEATS)
    .select('assistant_id, user_id')
    .in('user_id', ids);
  if (error) {
    // A list that cannot say who is a bot still shows the conversation.
    logger.error('Could not read bot seats', { error: error.message }, 'BotSeats');
    return seats;
  }
  for (const row of (data ?? []) as Array<{ assistant_id: string | null; user_id: string }>) {
    seats.set(row.user_id, row.assistant_id);
  }
  return seats;
}

async function findSeat(admin: SupabaseClient, assistantId: string): Promise<string | null> {
  const { data } = await fromTable(admin, DATABASE_TABLES.COMPANION_SEATS)
    .select('user_id')
    .eq('assistant_id', assistantId)
    .maybeSingle();
  return (data as { user_id: string } | null)?.user_id ?? null;
}

/** The seat's profile says what the companion says: its name and its face. */
async function describeSeat(
  admin: SupabaseClient,
  seatUserId: string,
  companion: CompanionRow
): Promise<void> {
  const { error } = await fromTable(admin, DATABASE_TABLES.PROFILES)
    .update({
      name: companion.title?.trim() || 'Bot',
      avatar_url: companion.avatar_url,
    })
    .eq('id', seatUserId);
  if (error) {
    logger.warn('Could not describe a bot seat', { error: error.message }, 'BotSeats');
  }
}

/**
 * The seat of a companion, made if it has none.
 *
 * The handle is `seat_` and twelve random hex characters: config/
 * public-directory.ts keeps that shape out of people search, Discover and the
 * sitemap, because a seat is an account and not a person to find. Nothing in
 * the handle or the address names the companion or its owner.
 */
async function ensureSeat(admin: SupabaseClient, companion: CompanionRow): Promise<string | null> {
  const existing = await findSeat(admin, companion.id);
  if (existing) {
    await describeSeat(admin, existing, companion);
    return existing;
  }

  const tag = randomBytes(6).toString('hex');
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: `seat-${tag}@${SEAT_EMAIL_DOMAIN}`,
    email_confirm: true,
    // No password is set, so the account cannot be signed in to with one.
    user_metadata: { full_name: companion.title?.trim() || 'Bot' },
  });
  const seatUserId = created?.user?.id;
  if (createError || !seatUserId) {
    logger.error('Could not create a bot seat', { error: createError?.message }, 'BotSeats');
    return null;
  }

  // handle_new_user made the profile; give it the seat's handle and face.
  const { error: handleError } = await fromTable(admin, DATABASE_TABLES.PROFILES)
    .update({ username: `seat_${tag}` })
    .eq('id', seatUserId);
  if (handleError) {
    logger.error('Could not name a bot seat', { error: handleError.message }, 'BotSeats');
    await admin.auth.admin.deleteUser(seatUserId);
    return null;
  }
  await describeSeat(admin, seatUserId, companion);

  const { error: linkError } = await fromTable(admin, DATABASE_TABLES.COMPANION_SEATS).insert({
    assistant_id: companion.id,
    user_id: seatUserId,
  });
  if (linkError) {
    // Two requests raced: the other one's seat stands, this account goes.
    await admin.auth.admin.deleteUser(seatUserId);
    return findSeat(admin, companion.id);
  }
  return seatUserId;
}

/**
 * The seats of these companions, for somebody starting a conversation.
 *
 * Only the caller's OWN companions for now (ADR-0015, build order 1): a
 * companion that is not theirs is refused, whatever its id. Null when any of
 * them cannot be seated, so a conversation is never opened with a bot missing.
 */
export async function seatOwnCompanions(
  admin: SupabaseClient,
  ownerId: string,
  assistantIds: readonly string[]
): Promise<BotSeat[] | null> {
  const ids = [...new Set(assistantIds)];
  if (ids.length === 0) {
    return [];
  }
  const { data, error } = await fromTable(admin, DATABASE_TABLES.AI_ASSISTANTS)
    .select('id, user_id, title, avatar_url')
    .in('id', ids)
    .eq('user_id', ownerId);
  const companions = (data ?? []) as CompanionRow[];
  if (error || companions.length !== ids.length) {
    return null;
  }
  const seats: BotSeat[] = [];
  for (const companion of companions) {
    const userId = await ensureSeat(admin, companion);
    if (!userId) {
      return null;
    }
    seats.push({ assistantId: companion.id, userId });
  }
  return seats;
}

/**
 * May `callerId` start a conversation with these accounts? A seat can be
 * written to only by the owner of its companion: somebody who learned a
 * seat's account id must not be able to open a conversation with another
 * person's private bot.
 */
export async function foreignSeatAmong(
  admin: SupabaseClient,
  callerId: string,
  userIds: readonly string[]
): Promise<boolean> {
  const seats = await seatsOfAccounts(admin, userIds);
  if (seats.size === 0) {
    return false;
  }
  const { data } = await fromTable(admin, DATABASE_TABLES.AI_ASSISTANTS)
    .select('id')
    .in(
      'id',
      [...seats.values()].filter((id): id is string => id !== null)
    )
    .eq('user_id', callerId);
  // A seat whose companion is gone belongs to nobody: nobody may open it.
  return ((data ?? []) as unknown[]).length !== seats.size;
}

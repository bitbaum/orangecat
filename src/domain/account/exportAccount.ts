/**
 * Everything "Export my data" puts in the file, gathered for one person.
 *
 * The settings copy promises "the data we store about you", so the file holds
 * what the person wrote, created and took part in, not only their Cat history.
 * Until 2026-11 it read a fixed list of ten tables and left out every page,
 * wallet, post, follow, membership and payment.
 *
 * Reads go through the caller's request-scoped (RLS) client, so the file can
 * only ever contain rows the person may already see. Pages are found through
 * ENTITY_REGISTRY (the SSOT for entity tables and their owner column), so a new
 * entity type is exported without touching this file.
 *
 * Left out on purpose (named in `manifest.excluded`): encrypted API keys, the
 * Cat memory and interest embedding vectors (internal derivatives), the wallet
 * connection secret, and messages other people sent.
 */

import { ENTITY_REGISTRY, ENTITY_TYPES } from '@/config/entity-registry';
import { DATABASE_TABLES, OWN_PROFILE_VIEW, WALLET_CLIENT_COLUMNS } from '@/config/database-tables';
import { getUserActorIds } from '@/domain/actors';
import type { AnySupabaseClient } from '@/lib/supabase/types';

type Rows = unknown[];

async function read(
  label: string,
  query: PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<Rows> {
  const { data, error } = await query;
  if (error) {
    // A partial file presented as complete is worse than no file.
    throw new Error(`Export failed reading ${label}: ${error.message}`);
  }
  return (data as Rows | null) ?? [];
}

function byColumn(
  supabase: AnySupabaseClient,
  table: string,
  column: string,
  ids: readonly string[],
  select = '*'
): Promise<Rows> {
  if (ids.length === 0) {
    return Promise.resolve([]);
  }
  return read(
    table,
    supabase
      .from(table)
      .select(select)
      .in(column, ids as string[])
  );
}

/** Rows of a two-party table where the person is either party. */
function asEitherParty(
  supabase: AnySupabaseClient,
  table: string,
  columns: readonly [string, string],
  userId: string
): Promise<Rows> {
  return read(
    table,
    supabase.from(table).select('*').or(`${columns[0]}.eq.${userId},${columns[1]}.eq.${userId}`)
  );
}

/** Every page the person owns, keyed by entity type. */
async function ownPages(
  supabase: AnySupabaseClient,
  userId: string,
  actorIds: readonly string[]
): Promise<Record<string, Rows>> {
  const entries = await Promise.all(
    ENTITY_TYPES.map(async type => {
      const meta = ENTITY_REGISTRY[type];
      // `actor_id` holds an actor; every other owner column holds the user id.
      const owners = meta.userIdField === 'actor_id' ? actorIds : [userId];
      const select = meta.tableName === DATABASE_TABLES.WALLETS ? WALLET_CLIENT_COLUMNS : '*';
      return [type, await byColumn(supabase, meta.tableName, meta.userIdField, owners, select)];
    })
  );
  return Object.fromEntries(entries);
}

export const EXPORT_SCOPE = [
  'profile',
  'pages: every page you own, by kind (projects, products, services, causes, events, assets, loans, investments, research, wishlists, documents, bots, circles, groups you founded, wallets)',
  'posts: timeline posts you wrote',
  'follows: who you follow and who follows you',
  'group_memberships',
  'payment_requests and orders you are a party to',
  'notifications',
  'ai_preferences',
  'notification_preferences',
  'cat_conversations',
  'cat_messages',
  'cat_memories (content only)',
  'cat_interests (topics only)',
  'economic_profile',
  'credit_entries',
  'credit_topups',
  'sent_messages (only messages you sent; other participants’ messages are theirs)',
] as const;

export const EXPORT_EXCLUDED = [
  'encrypted API keys',
  'embedding vectors behind Cat memories and interests (internal derivatives)',
  'the wallet connection secret',
] as const;

export async function exportAccount(supabase: AnySupabaseClient, userId: string) {
  const actorIds = await getUserActorIds(supabase, userId);
  const me = [userId];
  // A post is recorded against the user id in some paths and the actor in others.
  const authors = [userId, ...actorIds];

  const [
    profile,
    pages,
    posts,
    follows,
    groupMemberships,
    paymentRequests,
    orders,
    notifications,
    aiPreferences,
    notificationPreferences,
    catConversations,
    catMessages,
    catMemories,
    catInterests,
    economicProfile,
    creditEntries,
    creditTopups,
    sentMessages,
  ] = await Promise.all([
    // The owner-scoped view, not the table: `authenticated` cannot read the
    // email, phone and contact email columns off `profiles` (20260917163100).
    byColumn(supabase, OWN_PROFILE_VIEW, 'id', me),
    ownPages(supabase, userId, actorIds),
    byColumn(supabase, DATABASE_TABLES.TIMELINE_EVENTS, 'actor_id', authors),
    asEitherParty(supabase, DATABASE_TABLES.FOLLOWS, ['follower_id', 'following_id'], userId),
    byColumn(supabase, DATABASE_TABLES.GROUP_MEMBERS, 'user_id', me),
    asEitherParty(supabase, DATABASE_TABLES.PAYMENT_REQUESTS, ['requester_id', 'payer_id'], userId),
    asEitherParty(supabase, DATABASE_TABLES.ORDERS, ['buyer_id', 'seller_id'], userId),
    byColumn(supabase, DATABASE_TABLES.NOTIFICATIONS, 'user_id', me),
    byColumn(supabase, DATABASE_TABLES.USER_AI_PREFERENCES, 'user_id', me),
    byColumn(supabase, DATABASE_TABLES.NOTIFICATION_PREFERENCES, 'user_id', me),
    byColumn(supabase, DATABASE_TABLES.CAT_CONVERSATIONS, 'user_id', me),
    byColumn(supabase, DATABASE_TABLES.CAT_MESSAGES, 'user_id', me),
    byColumn(
      supabase,
      DATABASE_TABLES.CAT_MEMORIES,
      'user_id',
      me,
      'id, content, source, source_conversation_id, created_at'
    ),
    byColumn(
      supabase,
      DATABASE_TABLES.CAT_INTERESTS,
      'user_id',
      me,
      'id, topic, source, created_at'
    ),
    byColumn(supabase, DATABASE_TABLES.USER_ECONOMIC_PROFILE, 'user_id', me),
    byColumn(supabase, DATABASE_TABLES.CAT_CREDIT_ENTRIES, 'user_id', me),
    byColumn(supabase, DATABASE_TABLES.CAT_CREDIT_TOPUPS, 'user_id', me),
    byColumn(supabase, DATABASE_TABLES.MESSAGES, 'sender_id', me),
  ]);

  return {
    manifest: {
      product: 'OrangeCat',
      exported_at: new Date().toISOString(),
      user_id: userId,
      scope: [...EXPORT_SCOPE],
      excluded: [...EXPORT_EXCLUDED],
    },
    profile,
    pages,
    posts,
    follows,
    group_memberships: groupMemberships,
    payment_requests: paymentRequests,
    orders,
    notifications,
    ai_preferences: aiPreferences,
    notification_preferences: notificationPreferences,
    cat_conversations: catConversations,
    cat_messages: catMessages,
    cat_memories: catMemories,
    cat_interests: catInterests,
    economic_profile: economicProfile,
    credit_entries: creditEntries,
    credit_topups: creditTopups,
    sent_messages: sentMessages,
  };
}

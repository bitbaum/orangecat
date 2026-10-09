/**
 * Watches on PEOPLE — "tell me when she posts", "tell me when anyone I follow
 * posts about Lightning". Evaluated by the cat-watches timer alongside the
 * condition watches in ./proactive, with the service-role client.
 *
 * Unlike a condition watch these are STANDING: they stay active and notify
 * once per new post until cancelled. What keeps that from becoming spam or a
 * repeat is the cursor, `last_seen_at` — the created_at of the newest post the
 * watch has already looked at:
 *
 *   - only posts AFTER the cursor are considered;
 *   - the cursor is advanced (compare-and-set on its old value) BEFORE the
 *     notification is sent, so a crash or a concurrent run can lose one
 *     notification but never send the same post twice;
 *   - a post that does not match the keyword still moves the cursor, so it is
 *     never re-read.
 *
 * Cost is a constant number of queries per run, whatever the number of
 * watches: one follows read for every following_topic watcher, one posts read
 * per chunk of authors (ascending, bounded), one profiles read for the names
 * in notifications. No AI is ever called — matching is keyword-only.
 *
 * Visibility: only `visibility = 'public'`, non-deleted posts. A follow is not
 * a grant of access, and a notification is a place a private post must never
 * leak into.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { NotificationService } from '@/lib/services/notifications';
import { logger } from '@/utils/logger';
import { POST_PATH } from './following-scope';
import { textMatchesKeyword } from './search-tokens';

const LOG_SOURCE = 'CatSocialWatches';

export const SOCIAL_WATCH_KINDS = ['person_posts', 'following_topic'] as const;
export type SocialWatchKind = (typeof SOCIAL_WATCH_KINDS)[number];

export function isSocialWatchKind(kind: unknown): kind is SocialWatchKind {
  return (SOCIAL_WATCH_KINDS as readonly unknown[]).includes(kind);
}

/** Follow edges read per run for following_topic watchers (all watchers together). */
const MAX_FOLLOW_ROWS = 5000;
/** Authors per posts query — keeps the `in.(…)` list well inside a URL. */
const AUTHOR_CHUNK = 100;
/** Posts read per chunk per run. Ascending, so anything beyond is read next run. */
const MAX_POSTS_PER_CHUNK = 200;

export interface SocialWatchRow {
  id: string;
  user_id: string;
  kind: SocialWatchKind;
  label: string;
  /** person_posts: optional keyword. following_topic: the topic (required). */
  topic: string | null;
  subject_user_id: string | null;
  last_seen_at: string | null;
  created_at: string;
}

interface PostRow {
  id: string;
  actor_id: string;
  title: string | null;
  description: string | null;
  created_at: string;
}

export interface SocialWatchRunResult {
  fired: number;
  errors: number;
}

/** Posts younger than this may still be committing; never move a cursor past them. */
const SETTLE_MS = 60 * 1000;
/** An idle watch's cursor is caught up at most this often (one write a day). */
const IDLE_CATCH_UP_MS = 24 * 60 * 60 * 1000;

/**
 * Catch an idle watch's cursor up when the read was truncated (it is holding
 * `since` back right now), or when it has fallen a day behind. Compared as
 * instants: the cursor is a database timestamp, `readUpTo` may be a JS one,
 * and their string forms do not sort together.
 */
export function shouldCatchUpIdle(cursor: string, readUpTo: string, truncated: boolean): boolean {
  const c = Date.parse(cursor);
  const r = Date.parse(readUpTo);
  if (!Number.isFinite(c) || !Number.isFinite(r) || c >= r) {
    return false;
  }
  return truncated || r - c > IDLE_CATCH_UP_MS;
}

function cursorOf(w: SocialWatchRow): string {
  return w.last_seen_at ?? w.created_at;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** watcher id → the people they follow (themselves excluded). */
async function loadFollows(
  admin: SupabaseClient,
  watcherIds: string[]
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  if (watcherIds.length === 0) {
    return map;
  }
  const { data, error } = await admin
    .from(DATABASE_TABLES.FOLLOWS)
    .select('follower_id, following_id')
    .in('follower_id', watcherIds)
    .limit(MAX_FOLLOW_ROWS);
  if (error) {
    throw new Error(`follows read failed: ${error.message ?? 'unknown'}`);
  }
  for (const row of (data ?? []) as Array<{ follower_id: string; following_id: string }>) {
    if (row.follower_id === row.following_id) {
      continue;
    }
    const set = map.get(row.follower_id) ?? new Set<string>();
    set.add(row.following_id);
    map.set(row.follower_id, set);
  }
  return map;
}

/**
 * Public posts by these authors after `since`, oldest first, plus the
 * HORIZON: when a chunk came back full, the posts after its last row are still
 * unread, so nothing at or beyond that instant may be judged (or move a
 * cursor) this run. `null` = everything up to now was read.
 */
async function loadPosts(
  admin: SupabaseClient,
  authorIds: string[],
  since: string
): Promise<{ posts: PostRow[]; horizon: string | null }> {
  const results = await Promise.all(
    chunk(authorIds, AUTHOR_CHUNK).map(async ids => {
      const { data, error } = await admin
        .from(DATABASE_TABLES.TIMELINE_EVENTS)
        .select('id, actor_id, title, description, created_at')
        .in('actor_id', ids)
        .eq('visibility', 'public')
        .eq('is_deleted', false)
        .gt('created_at', since)
        .order('created_at', { ascending: true })
        .limit(MAX_POSTS_PER_CHUNK);
      if (error) {
        throw new Error(`posts read failed: ${error.message ?? 'unknown'}`);
      }
      return (data ?? []) as PostRow[];
    })
  );
  let horizon: string | null = null;
  for (const rows of results) {
    if (rows.length >= MAX_POSTS_PER_CHUNK) {
      const last = rows[rows.length - 1].created_at;
      if (horizon === null || last < horizon) {
        horizon = last;
      }
    }
  }
  const posts = results.flat().filter(p => horizon === null || p.created_at < horizon);
  posts.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  return { posts, horizon };
}

/** Whose posts this watch is about. */
function authorsFor(w: SocialWatchRow, follows: Map<string, Set<string>>): Set<string> {
  if (w.kind === 'person_posts') {
    return new Set(w.subject_user_id && w.subject_user_id !== w.user_id ? [w.subject_user_id] : []);
  }
  return follows.get(w.user_id) ?? new Set<string>();
}

function postText(p: PostRow): string {
  return [p.title, p.description].filter(Boolean).join(' — ');
}

/** Which of these new posts does the watch care about? */
export function matchingPosts(w: SocialWatchRow, posts: PostRow[]): PostRow[] {
  const keyword = (w.topic ?? '').trim();
  if (w.kind === 'following_topic' && !keyword) {
    return [];
  }
  return keyword ? posts.filter(p => textMatchesKeyword(postText(p), keyword)) : posts;
}

/**
 * Move the cursor from `from` to `to`, only if nobody else moved it first.
 * @returns true when THIS call moved it (and so owns the notification).
 */
async function advanceCursor(
  admin: SupabaseClient,
  w: SocialWatchRow,
  to: string
): Promise<boolean> {
  let q = admin
    .from(DATABASE_TABLES.CAT_WATCHES)
    .update({ last_seen_at: to })
    .eq('id', w.id)
    .eq('status', 'active');
  q = w.last_seen_at === null ? q.is('last_seen_at', null) : q.eq('last_seen_at', w.last_seen_at);
  const { data, error } = await q.select('id');
  if (error) {
    throw new Error(`cursor update failed: ${error.message ?? 'unknown'}`);
  }
  return Array.isArray(data) && data.length > 0;
}

function snippet(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 120 ? `${flat.slice(0, 117)}…` : flat;
}

/** Evaluate every person_posts / following_topic watch in one batched pass. */
export async function evaluateSocialWatches(
  admin: SupabaseClient,
  watches: SocialWatchRow[],
  notifications: Pick<NotificationService, 'createNotification'>
): Promise<SocialWatchRunResult> {
  const result: SocialWatchRunResult = { fired: 0, errors: 0 };
  if (watches.length === 0) {
    return result;
  }

  let follows: Map<string, Set<string>>;
  let posts: PostRow[];
  let horizon: string | null;
  // Anything committed before this has certainly landed by the time we read.
  const settledBefore = new Date(Date.now() - SETTLE_MS).toISOString();
  try {
    follows = await loadFollows(admin, [
      ...new Set(watches.filter(w => w.kind === 'following_topic').map(w => w.user_id)),
    ]);
    const authors = new Set<string>();
    const cursors: string[] = [];
    for (const w of watches) {
      const own = authorsFor(w, follows);
      if (own.size > 0) {
        own.forEach(a => authors.add(a));
        cursors.push(cursorOf(w));
      }
    }
    if (authors.size === 0) {
      return result;
    }
    // Database timestamps, all in one format, so they sort as strings.
    const since = cursors.reduce((min, c) => (c < min ? c : min));
    ({ posts, horizon } = await loadPosts(admin, [...authors], since));
  } catch (error) {
    logger.error('social watch batch read failed', { error }, LOG_SOURCE);
    return { fired: 0, errors: 1 };
  }
  // How far this run's read is complete. An idle watch's cursor is moved up
  // to here now and then, or one quiet person would pin `since` (the oldest
  // cursor) forever and every run would re-read the same old posts.
  const readUpTo = horizon ?? settledBefore;

  // Judge each watch against the posts it has not seen yet.
  const toFire: Array<{ watch: SocialWatchRow; hits: PostRow[] }> = [];
  for (const w of watches) {
    try {
      const authors = authorsFor(w, follows);
      const cursor = cursorOf(w);
      const unseen = posts.filter(
        p => p.created_at > cursor && authors.has(p.actor_id) && p.actor_id !== w.user_id
      );
      if (unseen.length === 0) {
        if (shouldCatchUpIdle(cursor, readUpTo, horizon !== null)) {
          await advanceCursor(admin, w, readUpTo);
        }
        continue;
      }
      const newest = unseen[unseen.length - 1].created_at;
      const hits = matchingPosts(w, unseen);
      // Cursor first: whatever happens next, these posts are never re-judged.
      const owned = await advanceCursor(admin, w, newest);
      if (owned && hits.length > 0) {
        toFire.push({ watch: w, hits });
      }
    } catch (error) {
      result.errors += 1;
      logger.error('social watch evaluation failed', { watchId: w.id, error }, LOG_SOURCE);
    }
  }
  if (toFire.length === 0) {
    return result;
  }

  // Names for the notifications, in one read.
  const authorIds = [...new Set(toFire.flatMap(f => f.hits.map(h => h.actor_id)))];
  const names = new Map<string, string>();
  const { data: profiles } = await admin
    .from(DATABASE_TABLES.PROFILES)
    .select('id, username, name')
    .in('id', authorIds);
  for (const p of (profiles ?? []) as Array<{
    id: string;
    username: string | null;
    name: string | null;
  }>) {
    names.set(p.id, p.username ? `@${p.username}` : (p.name ?? 'Someone'));
  }

  for (const { watch, hits } of toFire) {
    const latest = hits[hits.length - 1];
    const who = names.get(latest.actor_id) ?? 'Someone you follow';
    const more = hits.length > 1 ? ` (+${hits.length - 1} more)` : '';
    try {
      const sent = await notifications.createNotification({
        recipientUserId: watch.user_id,
        type: 'system',
        title: 'Cat watch',
        message: `👁️ ${watch.label} — ${who}: "${snippet(postText(latest))}"${more}`,
        actionUrl: `${POST_PATH}/${latest.id}`,
        metadata: {
          kind: 'cat_watch',
          watchId: watch.id,
          watchKind: watch.kind,
          postIds: hits.map(h => h.id),
        },
      });
      if (sent.success) {
        result.fired += 1;
      } else {
        result.errors += 1;
      }
    } catch (error) {
      result.errors += 1;
      logger.error('social watch notify failed', { watchId: watch.id, error }, LOG_SOURCE);
    }
  }
  return result;
}

/**
 * create_watch for the two kinds that follow PEOPLE (see ../social-watches):
 *
 *   person_posts     — "tell me when @alice posts" (optionally: "…about Lightning")
 *   following_topic  — "tell me when anyone I follow posts about Lightning"
 *
 * Runs with the user-scoped client (RLS), like every other create_watch. The
 * cursor starts NOW: a new watch announces new posts, never a backlog.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { cleanTopic, isValidTopic } from '../interests';
import type { SocialWatchKind } from '../social-watches';
import { resolveProfileByUsername } from './social';
import type { ActionHandler } from './types';

/** Standing watches notify repeatedly, so they get their own, tighter, cap. */
export const MAX_ACTIVE_SOCIAL_WATCHES = 20;

type HandlerResult = Awaited<ReturnType<ActionHandler>>;

export async function createSocialWatch(
  supabase: Parameters<ActionHandler>[0],
  userId: string,
  kind: SocialWatchKind,
  label: string,
  params: Record<string, unknown>
): Promise<HandlerResult> {
  const rawTopic = typeof params.topic === 'string' ? params.topic : '';
  if (rawTopic.trim() && !isValidTopic(rawTopic)) {
    return {
      success: false,
      error: `"${rawTopic}" is not a usable topic or keyword (2–80 chars).`,
    };
  }
  const topic = rawTopic.trim() ? cleanTopic(rawTopic) : null;

  let subject: { id: string; username: string } | null = null;
  if (kind === 'person_posts') {
    const raw = String(params.username ?? '').trim();
    if (!raw) {
      return {
        success: false,
        error: 'person_posts needs username — the @handle of the person whose posts to watch.',
      };
    }
    subject = await resolveProfileByUsername(supabase, raw);
    if (!subject) {
      return { success: false, error: `No user found with username "${raw}".` };
    }
    if (subject.id === userId) {
      return { success: false, error: 'That is you — no need to watch your own posts.' };
    }
  } else if (!topic) {
    return {
      success: false,
      error: 'following_topic needs topic — what the people they follow should be posting about.',
    };
  }

  const { data: existing } = await supabase
    .from(DATABASE_TABLES.CAT_WATCHES)
    .select('id, kind, topic, subject_user_id')
    .eq('user_id', userId)
    .in('kind', ['person_posts', 'following_topic'])
    .eq('status', 'active');
  const rows = (existing ?? []) as Array<{
    id: string;
    kind: string;
    topic: string | null;
    subject_user_id: string | null;
  }>;
  const same = rows.find(
    r =>
      r.kind === kind &&
      (r.subject_user_id ?? null) === (subject?.id ?? null) &&
      (r.topic ?? '').toLowerCase() === (topic ?? '').toLowerCase()
  );
  if (same) {
    return {
      success: true,
      data: {
        id: same.id,
        displayMessage: `👁️ Already watching: ${describe(kind, subject, topic)}`,
      },
    };
  }
  if (rows.length >= MAX_ACTIVE_SOCIAL_WATCHES) {
    return {
      success: false,
      error: `You already have ${rows.length} active watches on people (max ${MAX_ACTIVE_SOCIAL_WATCHES}). Cancel one first.`,
    };
  }

  let followsNobody = false;
  if (kind === 'following_topic') {
    const { data: follows } = await supabase
      .from(DATABASE_TABLES.FOLLOWS)
      .select('following_id')
      .eq('follower_id', userId)
      .limit(1);
    followsNobody = !follows || (follows as unknown[]).length === 0;
  }

  const { data, error } = await supabase
    .from(DATABASE_TABLES.CAT_WATCHES)
    .insert({
      user_id: userId,
      kind,
      label,
      topic,
      subject_user_id: subject?.id ?? null,
      last_seen_at: new Date().toISOString(),
    })
    .select('id, kind, label, topic, subject_user_id')
    .single();
  if (error) {
    return { success: false, error: error.message };
  }
  const note = followsNobody
    ? ' You don’t follow anyone yet, so it will stay quiet until you do.'
    : '';
  return {
    success: true,
    data: {
      ...(data as Record<string, unknown>),
      username: subject?.username ?? null,
      displayMessage: `👁️ Watching: ${describe(kind, subject, topic)} (checked every 15 min, until you cancel it).${note}`,
    },
  };
}

function describe(
  kind: SocialWatchKind,
  subject: { username: string } | null,
  topic: string | null
): string {
  if (kind === 'person_posts') {
    return `new posts by @${subject?.username ?? '?'}${topic ? ` about "${topic}"` : ''}`;
  }
  return `posts about "${topic ?? ''}" from people you follow`;
}

/**
 * Answering a mention on the wall.
 *
 * Same promise as in a private message — the Cat answers where it was asked —
 * but the context is different in a way that matters. On X, tagging Grok under
 * a reply gets you an answer about that reply. Here the Cat reads the THREAD:
 * the post that started it and the replies leading to the one that tagged it.
 * "@cat is this realistic?" three replies deep is a question about the
 * conversation, and answering it from the last sentence alone is the difference
 * between an assistant and an autocomplete.
 */

import { CAT_CONTEXT_MESSAGE_WINDOW, CAT_DISPLAY_NAME, CAT_MENTION } from '@/config/cat-identity';
import { DATABASE_TABLES } from '@/config/database-tables';
import { callPlatformJson, parseJsonLoose } from '@/services/cat/platform-llm';
import { writeTimelineReply } from '@/services/timeline/write-timeline-reply';
import { logger } from '@/utils/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

export const CAT_POST_FALLBACK =
  "I couldn't work that one out just now — tag me again and I'll try afresh.";

const SYSTEM_PROMPT = [
  `You are ${CAT_DISPLAY_NAME}, the OrangeCat agent, replying publicly under someone's post.`,
  `You were tagged with ${CAT_MENTION}. Answer the question using the thread for context.`,
  'This is a public reply: be brief, specific and useful to anyone reading, not just the asker.',
  'Two or three sentences. No preamble, no restating the question, no sign-off.',
  'If you do not know something, say so in one clause and say what would settle it.',
  'Respond as JSON: {"reply": "<your message>"}',
].join('\n');

export interface ThreadEvent {
  id: string;
  actor_id: string;
  title: string | null;
  description: string | null;
  parent_event_id: string | null;
  thread_id: string | null;
  created_at: string;
  /** What the post is about (a project, a profile …) — how the Cat resolves "this". */
  subject_type?: string | null;
  subject_id?: string | null;
}

/**
 * The post that was tagged, plus the thread it belongs to, oldest first.
 *
 * Falls back to the tagged post alone when it starts a thread of its own — a
 * top-level post has no ancestors, and that is not a failure.
 */
const THREAD_COLUMNS =
  'id, actor_id, title, description, parent_event_id, thread_id, created_at, subject_type, subject_id';

export async function loadThreadContext(
  admin: SupabaseClient,
  eventId: string
): Promise<ThreadEvent[]> {
  const { data: tagged } = await admin
    .from(DATABASE_TABLES.TIMELINE_EVENTS)
    .select(THREAD_COLUMNS)
    .eq('id', eventId)
    .maybeSingle();

  if (!tagged) {
    return [];
  }
  const event = tagged as ThreadEvent;
  const threadId = event.thread_id ?? event.parent_event_id ?? event.id;

  const { data: thread } = await admin
    .from(DATABASE_TABLES.TIMELINE_EVENTS)
    .select(THREAD_COLUMNS)
    .or(`id.eq.${threadId},thread_id.eq.${threadId}`)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(CAT_CONTEXT_MESSAGE_WINDOW);

  const rows = (thread ?? []) as ThreadEvent[];
  // The tagged post itself must be present even if the thread query missed it
  // (a brand-new row, or one whose thread_id was never set).
  return rows.some(r => r.id === event.id) ? rows : [...rows, event];
}

export function buildThreadPrompt(events: ThreadEvent[], taggedId: string): string {
  const lines = events.map(e => {
    const body = (e.description ?? e.title ?? '').trim();
    const marker = e.id === taggedId ? ' <- tagged you here' : '';
    return `- ${body}${marker}`;
  });
  return [
    'Thread (oldest first):',
    lines.join('\n'),
    '',
    'Reply to the post that tagged you.',
  ].join('\n');
}

/**
 * @returns true when a reply was posted. As in a private message, a failure to
 *   think still produces an answer rather than silence — under a public post
 *   that matters more, not less, because everyone can see nothing happened.
 */
export async function replyToPostMention(
  admin: SupabaseClient,
  params: { eventId: string; catId: string }
): Promise<boolean> {
  const { eventId, catId } = params;

  const thread = await loadThreadContext(admin, eventId);
  if (thread.length === 0) {
    logger.warn('Cat tagged on a post it cannot read', { eventId }, 'CatPostReply');
    return false;
  }

  let reply = '';
  try {
    const raw = await callPlatformJson(SYSTEM_PROMPT, buildThreadPrompt(thread, eventId), {
      timeoutMs: 30_000,
    });
    reply = (parseJsonLoose<{ reply?: string }>(raw)?.reply ?? '').trim();
  } catch (error) {
    logger.error(
      'Cat post reply generation failed',
      { eventId, error: error instanceof Error ? error.message : String(error) },
      'CatPostReply'
    );
  }

  await writeTimelineReply(admin, {
    parentEventId: eventId,
    actorId: catId,
    description: reply || CAT_POST_FALLBACK,
    // Marked so the UI can render a Cat reply distinctly rather than leaving a
    // reader to work out from the avatar that this one was written by an agent.
    metadata: { is_cat_reply: true, answered_event_id: eventId },
  });
  return true;
}

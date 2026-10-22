/**
 * The day's conversations, for the fleet's nightly chat reviewer.
 *
 * Loki fetches GET /api/chat/review-export with the shared CHAT_REVIEW_TOKEN
 * and judges every answer with chatkit's CHAT_REVIEW_INSTRUCTION: what the
 * person most likely wanted, what Cat could have given with the tools it
 * has, what it gave. This file is the product's half: the token check, the
 * scope sentence derived from Cat's own prompt and tool list (never typed a
 * second time), and the transcripts in chatkit's ChatTranscript shape —
 * anonymised, bounded, and without temporary chats.
 */

import { timingSafeEqual } from 'node:crypto';
import type { AnswerFeedback, ChatTranscript, ChatTranscriptTurn } from '@bitbaum/chatkit';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DATABASE_TABLES } from '@/config/database-tables';
import { buildCatSystemPrompt } from '@/services/cat/system-prompt';
import { PLATFORM_TOOL_DEFINITION } from '@/services/cat/platform-tool-definitions';
import { CAPABILITY_RULES } from '@/services/cat/capability-gate';
import { TRUNCATED_REPLY_SUFFIX, UNKNOWN_FAILURE_NOTE } from '@/services/cat/failed-turn';

/** The product key Loki files findings under (src/config/chat-review.ts there). */
export const CHAT_REVIEW_PRODUCT = 'orangecat';
export const REVIEW_EXPORT_MAX_CONVERSATIONS = 50;
export const REVIEW_EXPORT_MAX_TURNS = 30;
export const REVIEW_EXPORT_MAX_CONTENT = 4000;
const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ReviewTokenVerdict = 'ok' | 'unauthorized' | 'unconfigured';

/**
 * Bearer CHAT_REVIEW_TOKEN, compared in constant time. Fails closed: no token
 * in the environment means nobody is let in, and the route says so (503)
 * rather than answering an empty-string bearer.
 */
export function verifyChatReviewToken(request: Request): ReviewTokenVerdict {
  const token = process.env.CHAT_REVIEW_TOKEN;
  if (!token) {
    return 'unconfigured';
  }
  const header = request.headers.get('authorization') ?? '';
  const expected = Buffer.from(`Bearer ${token}`);
  const provided = Buffer.from(header);
  return expected.length === provided.length && timingSafeEqual(expected, provided)
    ? 'ok'
    : 'unauthorized';
}

const firstSentence = (text: string): string => {
  const m = text.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : text).trim();
};

/**
 * What this assistant can do, in Cat's own words: the platform paragraph of
 * its system prompt, its tool list with each tool's first sentence, and
 * whether the web is reachable from this deployment. Derived, not retyped,
 * so the reviewer judges against what the model is actually told.
 */
export function chatReviewScope(): string {
  const prompt = buildCatSystemPrompt({ actionsVia: 'tools' });
  const purpose = prompt.match(/## Your Purpose\n([\s\S]*?)(?=\n## )/)?.[1] ?? '';
  const platform =
    purpose
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .find(p => p.startsWith('OrangeCat is')) ?? '';
  const tools = PLATFORM_TOOL_DEFINITION.map(
    t => `${t.function.name} (${firstSentence(t.function.description)})`
  ).join('; ');
  const webOn = CAPABILITY_RULES.web.configured?.() ?? false;
  const web = webOn
    ? 'Web search and page reading are configured here, so it can look things up on the open web.'
    : 'No web search backend is configured here, so it cannot look things up on the open web.';
  return [platform, `Its tools: ${tools}.`, web].filter(Boolean).join(' ');
}

export interface ReviewMessageRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: unknown;
  created_at: string;
}
export interface ReviewFeedbackRow {
  conversation_id: string;
  message_id: string;
  verdict: 'up' | 'down';
  reason: string | null;
  text: string | null;
}
export interface ReviewConversationRow {
  id: string;
  updated_at: string;
}

/** The labels the thread showed for a turn ("web_search: completed (5)"). */
export function stepsFromToolCalls(toolCalls: unknown): string[] | undefined {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return undefined;
  }
  const steps = toolCalls
    .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === 'object')
    .map(c => {
      const name = typeof c.name === 'string' ? c.name : 'tool';
      const status = typeof c.status === 'string' ? c.status : 'unknown';
      const count = typeof c.resultCount === 'number' ? ` (${c.resultCount})` : '';
      return `${name}: ${status}${count}`;
    });
  return steps.length ? steps : undefined;
}

const turnFailed = (content: string): boolean =>
  content.endsWith(TRUNCATED_REPLY_SUFFIX) || content.trim() === UNKNOWN_FAILURE_NOTE;

/** One conversation in chatkit's shape: the last 30 turns, each ≤ 4000 chars, plus its thumbs. */
export function toTranscript(
  conversation: ReviewConversationRow,
  messages: ReviewMessageRow[],
  feedback: ReviewFeedbackRow[]
): ChatTranscript {
  const ordered = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const turns: ChatTranscriptTurn[] = ordered.slice(-REVIEW_EXPORT_MAX_TURNS).map(m => {
    const steps = m.role === 'assistant' ? stepsFromToolCalls(m.tool_calls) : undefined;
    const failed = m.role === 'assistant' && turnFailed(m.content);
    return {
      id: m.id,
      role: m.role,
      content: m.content.slice(0, REVIEW_EXPORT_MAX_CONTENT),
      ...(steps ? { steps } : {}),
      ...(failed ? { failed: true } : {}),
    };
  });
  const thumbs: AnswerFeedback[] = feedback.map(f => ({
    messageId: f.message_id,
    verdict: f.verdict,
    ...(f.reason ? { reason: f.reason as AnswerFeedback['reason'] } : {}),
    ...(f.text ? { text: f.text } : {}),
  }));
  return {
    id: conversation.id,
    at: ordered.at(-1)?.created_at ?? conversation.updated_at,
    surface: '/cat',
    turns,
    ...(thumbs.length ? { feedback: thumbs } : {}),
  };
}

/** `since` and `limit` as the query gives them, bounded. */
export function reviewExportWindow(url: string): { since: string; limit: number } {
  const params = new URL(url).searchParams;
  const sinceRaw = params.get('since');
  const sinceMs = sinceRaw ? Date.parse(sinceRaw) : NaN;
  const since = new Date(Number.isFinite(sinceMs) ? sinceMs : Date.now() - DEFAULT_WINDOW_MS);
  const limitRaw = Number(params.get('limit'));
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), REVIEW_EXPORT_MAX_CONVERSATIONS)
      : REVIEW_EXPORT_MAX_CONVERSATIONS;
  return { since: since.toISOString(), limit };
}

/** Conversations updated since `since`, newest first, never temporary ones. Service role only. */
export async function exportChatTranscripts(
  admin: AnySupabaseClient,
  window: { since: string; limit: number }
): Promise<ChatTranscript[]> {
  const { data: conversations, error } = await admin
    .from(DATABASE_TABLES.CAT_CONVERSATIONS)
    .select('id, updated_at')
    .eq('ephemeral', false)
    .gte('updated_at', window.since)
    .order('updated_at', { ascending: false })
    .limit(window.limit);
  if (error) {
    throw error;
  }
  const rows = (conversations ?? []) as ReviewConversationRow[];
  if (rows.length === 0) {
    return [];
  }
  const ids = rows.map(c => c.id);
  const [messagesRes, feedbackRes] = await Promise.all([
    admin
      .from(DATABASE_TABLES.CAT_MESSAGES)
      .select('id, conversation_id, role, content, tool_calls, created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: true }),
    admin
      .from(DATABASE_TABLES.CHAT_FEEDBACK)
      .select('conversation_id, message_id, verdict, reason, text')
      .in('conversation_id', ids)
      .order('created_at', { ascending: true }),
  ]);
  if (messagesRes.error) {
    throw messagesRes.error;
  }
  if (feedbackRes.error) {
    throw feedbackRes.error;
  }
  const messages = (messagesRes.data ?? []) as ReviewMessageRow[];
  const feedback = (feedbackRes.data ?? []) as ReviewFeedbackRow[];
  return rows
    .map(c =>
      toTranscript(
        c,
        messages.filter(m => m.conversation_id === c.id),
        feedback.filter(f => f.conversation_id === c.id)
      )
    )
    .filter(t => t.turns.length > 0);
}

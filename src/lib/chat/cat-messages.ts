/**
 * The Cat's turns as chatkit's thread draws them.
 *
 * Two roads lead here and must arrive at the same message: an answer that has
 * just streamed in (the transport, useCatTransport) and one read back from
 * the server when a chat is reopened (catConversationStore). Each turn is a
 * chatkit `ChatMessageData` — words, replies, citations, attachments — plus
 * the Cat's own record of what it did (`CatTurnExtras`), which the thread
 * hands back to `CatAnswerFooter` under the answer.
 *
 * Pure, so both roads are tested without a DOM or a network.
 */

import { extractReplies, type MessageAttachment } from '@bitbaum/chatkit';
import type {
  ChatMessageData,
  CitationMap as AnswerCitations,
  MessageChip,
} from '@bitbaum/chatkit/react';
import { getCreateSuggestionHref } from '@/config/cat-create-suggestions';
import { citationsFromToolCalls } from '@/lib/chat/citations';
import { parseUserMessage } from '@/lib/chat/attachment-tags';
import type { CatAction, ExecActionResult } from '@/types/cat';
import type { PrefillProposal, ToolCallEvent } from '@/services/cat/tool-use-types';

/**
 * The primary provider rate-limited and the route answered on another model;
 * the footer says which, so a different tone is not a surprise.
 */
export interface FallbackNotice {
  from: string;
  to: string;
  model: string;
  reason: string;
}

/** What the Cat did on a turn, kept on the message for its footer. */
export interface CatTurnExtras {
  /** Tools it ran, as chips under the answer. */
  toolCalls?: ToolCallEvent[];
  /** Suggested next steps that open a form. */
  actions?: CatAction[];
  /** Actions it ran (or that wait for a confirmation). */
  execResults?: ExecActionResult[];
  /** Drafts of a form the person can review. */
  prefillProposals?: PrefillProposal[];
  /** The provider rate-limited and another model answered. */
  fallback?: FallbackNotice;
  /** This task would have been sharper on a frontier model. */
  suggestUpgrade?: boolean;
  modelUsed?: string;
  provider?: string;
  /** When it was answered (ISO). */
  at?: string;
  /** Replies that open a page rather than say something (`Open /…`). */
  destinations?: string[];
}

export type CatMessage = ChatMessageData & CatTurnExtras;

/** Action and exec_action blocks are cards under the answer, never raw text. */
const CARD_FENCES = /```(?:action|exec_action)[\s\S]*?```/g;

function citationsFor(toolCalls: readonly ToolCallEvent[] | undefined): AnswerCitations {
  const map: AnswerCitations = {};
  for (const [id, source] of citationsFromToolCalls(toolCalls)) {
    let host = source.url;
    try {
      host = new URL(source.url).host;
    } catch {
      // Not a URL the browser can parse: show it as written.
    }
    map[id] = { label: source.title ?? host, detail: source.url, href: source.url };
  }
  return map;
}

/**
 * An answer as the thread wants it: the words without the card fences or the
 * replies block, the replies that SAY something as chatkit's reply buttons,
 * the ones that open a page kept apart (`destinations`) so the footer can
 * draw them as links, and `[F1]` marks resolved against the turn's sources.
 */
export function catAnswer(
  raw: { content: string; quickReplies?: readonly string[] } & CatTurnExtras
): Omit<CatMessage, 'id' | 'role'> {
  const { content, quickReplies, ...extras } = raw;
  const parsed = extractReplies(content.replace(CARD_FENCES, ''));
  const offered = quickReplies && quickReplies.length > 0 ? quickReplies : parsed.replies;
  const destinations = offered.filter(r => getCreateSuggestionHref(r));
  const citations = citationsFor(extras.toolCalls);
  return {
    ...extras,
    content: parsed.text.trim(),
    replies: offered.filter(r => !getCreateSuggestionHref(r)),
    ...(destinations.length > 0 ? { destinations } : {}),
    ...(Object.keys(citations).length > 0 ? { citations } : {}),
  };
}

/**
 * One of the person's own things (a listing, a note) on their message: the
 * same chip whether it was just sent (ChatApp's `chipsFor`) or read back from
 * the server.
 */
export function refChip(ref: { type: string; title: string }): MessageChip {
  return { label: ref.title, kind: ref.type };
}

/**
 * A person's turn read back from the server: the typed words, what went with
 * them (photos, files) as the thread's attachment chips, and their own things
 * as message chips. The tags are markup for the model; on screen they were
 * never text. A photo comes back by name only — its pixels are not kept.
 */
export function catUserTurn(
  content: string
): Pick<CatMessage, 'content' | 'attachments' | 'chips'> {
  const parsed = parseUserMessage(content);
  const attachments: MessageAttachment[] = [
    ...parsed.images.map(i => ({ kind: 'image' as const, name: i.name })),
    ...parsed.files.map(f => ({ kind: 'text' as const, name: f.name })),
  ];
  const chips = parsed.refs.map(refChip);
  return {
    content: parsed.text,
    ...(attachments.length > 0 ? { attachments } : {}),
    ...(chips.length > 0 ? { chips } : {}),
  };
}

/** One row of `GET /api/cat/conversations/{id}`. */
export interface StoredCatRow {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  model_used?: string | null;
  provider?: string | null;
  tool_calls?: ToolCallEvent[] | null;
}

/** A stored row as a thread message. Rows from before tool calls were kept
 *  carry `null` there and read exactly as they always did. */
export function catMessageFromRow(row: StoredCatRow): CatMessage {
  if (row.role === 'user') {
    return { id: row.id, role: 'user', ...catUserTurn(row.content) };
  }
  return {
    id: row.id,
    role: 'assistant',
    ...catAnswer({
      content: row.content,
      toolCalls: row.tool_calls ?? undefined,
      modelUsed: row.model_used ?? undefined,
      provider: row.provider ?? undefined,
      at: row.created_at,
    }),
  };
}

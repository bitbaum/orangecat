import type { ToolCallEvent } from './tool-use-types';
import type { ChatFailure } from '@bitbaum/chatkit/react';

export type StoredCatFailure = Required<ChatFailure>;

/**
 * What to store when a Cat turn fails.
 *
 * The success path persists a turn only once the model produced content, so a
 * provider failure used to drop the exchange entirely: the user's own words
 * were gone on reload, and the conversation was left with zero messages —
 * indistinguishable from someone who opened the page and never typed. Six real
 * accounts sat in exactly that state (June 2026), each having tried Cat once
 * and never returned, with no record of what they had asked.
 *
 * Kept as a pure function so the rule is testable without booting the
 * streaming orchestrator and its provider chain.
 */

/** Appended when a stream dies mid-answer, so the stored reply reads as truncated. */
export const TRUNCATED_REPLY_SUFFIX = '\n\n[This reply was cut off by a connection error.]';

/** Last-resort text if a caller somehow has no error copy to store. */
export const UNKNOWN_FAILURE_NOTE = "Cat couldn't complete this reply.";

export interface FailedTurnMessage {
  role: 'user' | 'assistant';
  content: string;
  model_used?: string;
  provider?: string;
  failure?: StoredCatFailure;
  tool_calls?: ToolCallEvent[];
}

export function buildFailedTurnMessages(params: {
  /** What the user actually typed — the thing worth not losing. */
  message: string;
  /** Any text that streamed before the failure. */
  partialContent?: string;
  /** The sentence the client was shown, so the thread reads back honestly. */
  errorText?: string;
  errorCode?: string;
  toolCalls?: ToolCallEvent[];
  model?: string;
  provider?: string;
}): FailedTurnMessage[] {
  const { message, partialContent = '', errorText = '', model, provider } = params;

  const partial = partialContent.trim();
  const assistantContent = partial
    ? `${partialContent}${TRUNCATED_REPLY_SUFFIX}`
    : errorText.trim() || UNKNOWN_FAILURE_NOTE;

  // Always a user/assistant pair: the next request replays history and then
  // appends the new user turn, so a dangling user message would put two user
  // turns back to back — a shape strict providers reject outright.
  return [
    { role: 'user', content: message },
    {
      role: 'assistant',
      content: assistantContent,
      model_used: model,
      provider,
      ...(params.toolCalls?.length ? { tool_calls: params.toolCalls } : {}),
      failure: {
        kind: params.errorCode ?? 'STREAM_ERROR',
        message: errorText.trim() || UNKNOWN_FAILURE_NOTE,
      },
    },
  ];
}

/** Failed attempts are displayed, but are not previous model answers. Remove
 * their adjacent user turn too, preserving provider-required alternation. */
export function completedHistory<
  T extends { role: 'user' | 'assistant'; content: string; failure?: StoredCatFailure | null },
>(rows: T[]): T[] {
  const result: T[] = [];
  for (const row of rows) {
    if (row.role === 'assistant' && row.failure) {
      if (result.at(-1)?.role === 'user') {
        result.pop();
      }
    } else {
      result.push(row);
    }
  }
  return result;
}

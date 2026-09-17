/**
 * One turn against a model running on the USER's machine — including the loop.
 *
 * ADR-0008 D2, the browser half. The server half (`/api/cat/local-complete`)
 * parses the envelope and runs the action; without this, it was executing into
 * a void: the client posted the reply fire-and-forget, discarded the results,
 * and rendered the RAW text — so the user watched an ```exec_action``` block
 * scroll past as JSON and never learned whether anything happened.
 *
 * The shape mirrors the hosted loop deliberately. The model asks for an action,
 * the action runs, the OUTCOME goes back to the model, and the model writes its
 * reply last — knowing what actually happened rather than guessing. That is the
 * whole reason ADR-0006 D2 exists, and a local model deserves it too.
 *
 * ONE RULE ABOVE ALL: a generated reply is posted exactly once. Posting the
 * same reply twice would execute its actions twice — a duplicate payment, a
 * duplicate project. So `intermediate` is decided before the post and never
 * revisited, and the final pass always persists.
 */
import { streamLocalChat } from '@/services/ai/local-runtime';
import { API_ROUTES } from '@/config/api-routes';
import type { ToolCallEvent } from '@/services/cat/tool-use-types';
import type { ExecActionResult } from '@/types/cat';

/**
 * How many times the local model may be run for one user message.
 *
 * Every pass is a full local inference, which on consumer hardware is seconds
 * of the user staring at a cursor — so this is a patience budget, not just a
 * loop guard. Three covers ask → act → report, which is the sequence that makes
 * the outcome trustworthy; the server's own per-reply ceiling bounds what any
 * single pass can do.
 */
export const MAX_LOCAL_PASSES = 3;

/** Cheap check for the envelope. A full parse is the server's job, not ours. */
const EXEC_FENCE = /```exec_action/;

export interface LocalTurnResult {
  /** The reply with the envelope removed — what the user should end up reading. */
  message: string;
  toolCalls: ToolCallEvent[];
  quickReplies?: string[];
}

interface CompleteResponse {
  message: string;
  execResults?: ExecActionResult[];
  quickReplies?: string[];
}

/** POST one finished reply to the server, which parses and executes it. */
async function postComplete(body: Record<string, unknown>, signal?: AbortSignal) {
  const res = await fetch(API_ROUTES.CAT.LOCAL_COMPLETE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    throw new Error(`local-complete returned HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data?: CompleteResponse };
  return json.data ?? { message: '' };
}

/**
 * Turn one executed action into a chip the user can read.
 *
 * The wording is not chosen here — `labelForTool` derives it from the action
 * registry, so a local `create_project` reads "Created project" exactly as it
 * does on the hosted path, and a status is never upgraded on the way through:
 * a pending action must not render as a completed one.
 */
function toToolCallEvent(result: ExecActionResult, pass: number, index: number): ToolCallEvent {
  const id = `local-${pass}-${index}-${result.actionId}`;
  if (result.status === 'completed') {
    return { id, name: result.actionId, status: 'completed', resultCount: 1, results: [] };
  }
  if (result.status === 'pending_confirmation') {
    return { id, name: result.actionId, status: 'pending_confirmation' };
  }
  return { id, name: result.actionId, status: 'failed', error: result.error };
}

/**
 * What the model is told happened. The highest-leverage prose in the loop: the
 * model writes its reply from this, so a failure that reads like a success
 * produces a Cat that tells the user their project is live when it is not.
 */
function summariseForModel(results: ExecActionResult[]): string {
  const lines = results.map(r => {
    if (r.status === 'completed') {
      return `- ${r.actionId}: done.${r.displayMessage ? ` ${r.displayMessage}` : ''}`;
    }
    if (r.status === 'pending_confirmation') {
      return `- ${r.actionId}: NOT done yet — it is waiting for the user to confirm it on screen.`;
    }
    return `- ${r.actionId}: FAILED.${r.error ? ` ${r.error}` : ''}`;
  });
  return (
    'Results of what you just asked for:\n' +
    lines.join('\n') +
    '\n\nNow write your reply to the user about what actually happened. Report a ' +
    'failure as a failure and something awaiting confirmation as still waiting — ' +
    'never describe either as done. Do not emit another exec_action block unless ' +
    'something genuinely still needs doing.'
  );
}

export interface RunLocalTurnParams {
  runtimeId: string;
  model: string;
  conversationId: string | null;
  /** The user's message, persisted alongside the final reply. */
  userMessage: string;
  messages: Array<{ role: string; content: string }>;
  signal?: AbortSignal;
  /** Streams tokens of the CURRENT pass into the bubble. */
  onChunk: (chunk: string) => void;
  /** Replaces the bubble with settled text — used to drop the envelope. */
  onReplaceContent: (text: string) => void;
  onToolCall: (event: ToolCallEvent) => void;
  /** Seams, so the loop is testable without a model or a server. */
  stream?: typeof streamLocalChat;
  post?: typeof postComplete;
}

export async function runLocalTurn(params: RunLocalTurnParams): Promise<LocalTurnResult> {
  const stream = params.stream ?? streamLocalChat;
  const post = params.post ?? postComplete;

  const messages = [...params.messages];
  const toolCalls: ToolCallEvent[] = [];
  let result: LocalTurnResult = { message: '', toolCalls };

  for (let pass = 0; pass < MAX_LOCAL_PASSES; pass++) {
    const reply = await stream({
      runtimeId: params.runtimeId,
      model: params.model,
      messages,
      signal: params.signal,
      onChunk: params.onChunk,
    });

    // Decided HERE and not revisited: `intermediate` controls whether the
    // server persists, and re-posting a reply to "correct" it would run its
    // actions a second time.
    const willLoop = EXEC_FENCE.test(reply) && pass < MAX_LOCAL_PASSES - 1;

    const data = await post(
      {
        conversationId: params.conversationId,
        message: params.userMessage,
        reply,
        model: params.model,
        intermediate: willLoop,
      },
      params.signal
    );

    const execResults = data.execResults ?? [];
    execResults.forEach((r, i) => {
      const event = toToolCallEvent(r, pass, i);
      toolCalls.push(event);
      params.onToolCall(event);
    });

    // The bubble showed the raw stream, envelope and all. Settle it.
    const settled = data.message || reply;
    params.onReplaceContent(settled);
    result = { message: settled, toolCalls, quickReplies: data.quickReplies };

    if (!willLoop) {
      return result;
    }

    messages.push({ role: 'assistant', content: settled });
    messages.push({
      role: 'system',
      content:
        execResults.length > 0
          ? summariseForModel(execResults)
          : 'That action block could not be read, so NOTHING ran. Tell the user plainly ' +
            'that you could not do it, or try once more with a correctly formed block.',
    });
  }

  return result;
}

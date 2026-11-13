/**
 * A bot's hands, offered to a model in the model's own tool format.
 *
 * The rest of a bot turn speaks one language: a reply that ends in a
 * `propose` fence (hands.ts). That stays, because every model can write it
 * and the thread, the card and the work loop are built on it. This file is
 * the adapter on either side of a model that takes native tools
 * (config/model-profiles.ts):
 *
 *   out  the hands become function definitions; earlier proposals in the
 *        history become the tool calls and tool results they were;
 *   in   a tool call in the answer becomes the same fence a prose model
 *        would have written, so nothing after the model call changes.
 *
 * Pure: no network, no database. One function is called per reply, as one
 * card is shown per reply.
 */
import type { CatAction } from '@/config/cat-actions';

import { extractProposal, withProposal, HANDS_SECTION_HEADING } from './hands';

export interface NativeTool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface NativeToolCall {
  id: string;
  name: string;
  arguments: string;
}

type Turn = { role: string; content: unknown };

const JSON_TYPE: Record<string, Record<string, unknown>> = {
  string: { type: 'string' },
  entity_id: { type: 'string' },
  user_id: { type: 'string' },
  btc: { type: 'number' },
  number: { type: 'number' },
  boolean: { type: 'boolean' },
  array: { type: 'array', items: { type: 'string' } },
  object: { type: 'object' },
};

/** The hands as function definitions, in the listed order. */
export function toolsFor(actions: readonly CatAction[]): NativeTool[] {
  return actions.map(a => ({
    type: 'function',
    function: {
      name: a.id,
      description: a.description.slice(0, 1000),
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          a.parameters.map(p => [
            p.name,
            {
              ...(JSON_TYPE[p.type] ?? JSON_TYPE.string),
              ...(p.description ? { description: p.description } : {}),
            },
          ])
        ),
        required: a.parameters.filter(p => p.required).map(p => p.name),
      },
    },
  }));
}

/** What the model is told a proposal became when nothing has run yet. */
export const WAITING_FOR_TAP =
  'Shown to the person as a card to approve. It has not run; it runs only when they tap it.';

const STEP_RESULT = /^\[OrangeCat ran [A-Za-z0-9_-]+\. Result:\]\n/;

/**
 * The conversation as a native-tools model expects it. An assistant turn
 * that ended in a proposal becomes its words plus a tool call; the next
 * line is the tool's result when the step ran (work loop), or the plain
 * fact that it is waiting for a tap. Every tool call is answered, which
 * every provider requires.
 */
export function toNativeMessages(messages: readonly Turn[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  let calls = 0;
  for (let i = 0; i < messages.length; i += 1) {
    const turn = messages[i];
    const found =
      turn.role === 'assistant' && typeof turn.content === 'string'
        ? extractProposal(turn.content)
        : null;
    if (!found?.proposal) {
      out.push({ role: turn.role, content: turn.content });
      continue;
    }
    calls += 1;
    const id = `call_${calls}`;
    out.push({
      role: 'assistant',
      content: found.text || null,
      tool_calls: [
        {
          id,
          type: 'function',
          function: {
            name: found.proposal.action,
            arguments: JSON.stringify(found.proposal.parameters),
          },
        },
      ],
    });
    const next = messages[i + 1];
    const ran =
      next?.role === 'user' && typeof next.content === 'string' && STEP_RESULT.test(next.content);
    out.push({
      role: 'tool',
      tool_call_id: id,
      content: ran ? (next.content as string) : WAITING_FOR_TAP,
    });
    if (ran) {
      i += 1;
    }
  }
  return out;
}

/**
 * The model's answer in the one language the rest of the turn speaks: its
 * words, and the first well-formed call to an offered hand as a fence. A
 * call to something not offered, or with arguments that are not an object,
 * is dropped and the words stand alone.
 */
export function replyFromNative(
  content: string,
  toolCalls: readonly NativeToolCall[] | undefined,
  actions: readonly CatAction[]
): string {
  for (const call of toolCalls ?? []) {
    const action = actions.find(a => a.id === call.name);
    if (!action) {
      continue;
    }
    let parameters: unknown;
    try {
      parameters = JSON.parse(call.arguments || '{}');
    } catch {
      continue;
    }
    if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
      continue;
    }
    // A model that calls a function often says nothing; the card needs a line.
    const words = content.trim() || `Here is what I will set up: ${action.name}.`;
    return withProposal(words, {
      action: action.id,
      parameters: parameters as Record<string, unknown>,
    });
  }
  return content;
}

/**
 * The prompt section for a model that is given the hands as functions: when
 * to call one and what a call means. The functions carry their own names
 * and parameters, so this is short.
 */
export function nativeHandsSection(
  actions: readonly CatAction[],
  autoIds: readonly string[] = []
): string | undefined {
  if (actions.length === 0) {
    return undefined;
  }
  const own = actions.filter(a => autoIds.includes(a.id)).map(a => a.id);
  return [
    HANDS_SECTION_HEADING,
    'OrangeCat can do things for the person, and they are given to you as functions. Call one when they ask you to make, create, book or send such a thing, or to ask, read or task Loki (the agent system that builds and runs their projects; a task starts a coding agent session there, and its answer is read back with loki_sessions; a live site is checked with walk_site, and a defect on it is filed with file_loki_finding).',
    'First write one sentence that names what you will set up, with its main details (never only "Sure"), then call exactly one function. Never write a call as text or in a code block. The person taps to approve it; until then nothing exists, so never say it is done, created or sent. Call only for what they asked, with the details they gave; ask for a missing required detail instead of inventing one. Never call a function in a group chat.',
    ...(own.length > 0
      ? [
          `Your owner lets you run these yourself, with no tap: ${own.join(', ')}. For these the function runs at once and its result is returned to you. Then carry on: call the next one if a step is needed, one at a time, or tell the person what came of it, quoting the result. Never run the same step twice, and never say a result you were not given.`,
        ]
      : []),
  ].join('\n');
}

/**
 * How one step of the Cat's tool loop reaches a model.
 *
 * Until now there was one way: POST to the provider's chat-completions URL
 * with a bearer key. A key the person keeps on Loki never comes here, so a
 * turn on it had no way at all, and the loop fell through to the next link
 * that did: the free pool. Seen live on 2026-11-13: the answer came from the
 * owner's Grok, the tool calls went to a pool that was spent, and "check my
 * calendar" ended as "that check stopped before it finished".
 *
 * A link on a Loki key now names itself in the loop's own two fields: the
 * endpoint is Loki's model door and the "key" is a marker that says whose
 * key and which provider. It is not a secret and is never sent as one: this
 * file reads it and asks the door, signed as that person, to make the call.
 * The door's answer is turned back into the provider shape the loop reads.
 */

import { LokiKeyError, lokiKeyService } from '@/services/ai/loki-key-service';

const LOKI_MARK = 'loki-door:';

/** The marker a Loki-held key travels as where a bearer key would. Not a secret. */
export function lokiToolKey(actorId: string, provider: string): string {
  return `${LOKI_MARK}${provider}:${actorId}`;
}

export function parseLokiToolKey(
  key: string | null | undefined
): { provider: string; actorId: string } | null {
  if (!key?.startsWith(LOKI_MARK)) {
    return null;
  }
  const rest = key.slice(LOKI_MARK.length);
  const cut = rest.indexOf(':');
  return cut > 0 && cut < rest.length - 1
    ? { provider: rest.slice(0, cut), actorId: rest.slice(cut + 1) }
    : null;
}

export interface ToolStepRequest {
  toolEndpoint: string;
  toolKey: string;
  model: string;
  messages: unknown[];
  tools: unknown[];
  maxTokens: number;
  signal: AbortSignal;
}

export type ToolStepAnswer =
  { ok: true; status: number; data: unknown } | { ok: false; status: number; bodyText: string };

/** The door's whole answer as the `choices[0]` the loop reads from a provider. */
export function asProviderAnswer(whole: {
  content: string;
  finishReason?: string;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
}): unknown {
  const calls = whole.toolCalls ?? [];
  return {
    choices: [
      {
        finish_reason: calls.length > 0 ? 'tool_calls' : (whole.finishReason ?? 'stop'),
        message: {
          role: 'assistant',
          content: whole.content || null,
          ...(calls.length > 0
            ? {
                tool_calls: calls.map(c => ({
                  id: c.id,
                  type: 'function',
                  function: { name: c.name, arguments: c.arguments },
                })),
              }
            : {}),
        },
      },
    ],
  };
}

/** One step: through Loki for a key kept there, else straight to the provider. */
export async function postToolStep(
  request: ToolStepRequest,
  viaLoki: typeof lokiKeyService = lokiKeyService
): Promise<ToolStepAnswer> {
  const held = parseLokiToolKey(request.toolKey);
  if (held) {
    try {
      const whole = await viaLoki(held.actorId, held.provider).chatCompletion({
        model: request.model,
        messages: request.messages,
        // Choosing a tool is not a creative act.
        temperature: 0,
        maxTokens: request.maxTokens,
        tools: request.tools,
      });
      return { ok: true, status: 200, data: asProviderAnswer(whole) };
    } catch (error) {
      return {
        ok: false,
        status: error instanceof LokiKeyError ? (error.status ?? 502) : 502,
        bodyText: error instanceof Error ? error.message : 'Loki did not answer',
      };
    }
  }
  const res = await fetch(request.toolEndpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${request.toolKey}`, 'Content-Type': 'application/json' },
    // Belt & braces with the loop's own race: the provider socket itself is
    // aborted at the same deadline so no orphaned request lingers.
    signal: request.signal,
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      tools: request.tools,
      tool_choice: 'auto',
      stream: false,
      max_tokens: request.maxTokens,
    }),
  });
  return res.ok
    ? { ok: true, status: res.status, data: await res.json() }
    : { ok: false, status: res.status, bodyText: await res.text().catch(() => '') };
}

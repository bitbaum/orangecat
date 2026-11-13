/**
 * A bot turn answered on a key the person keeps on Loki.
 *
 * The key never comes here. This client signs the turn as the person's actor
 * and Loki makes the call at the provider (services/loki/shared-keys.ts says
 * which keys the person switched on). It spends the person's own key, so only
 * a turn somebody sent, or a routine they set, may reach it.
 */
import { askLokiModelDoor } from '@/services/loki/shared-keys';
import type { SignedPostOptions } from '@/services/loki/signed-post';

import type { AiService } from './types';

/** A long answer on a slow model; Loki's own deadline at the provider is 110 s. */
const TURN_TIMEOUT_MS = 118_000;

interface DoorAnswer {
  done?: unknown;
  status?: unknown;
  detail?: unknown;
  content?: unknown;
  model?: unknown;
  finishReason?: unknown;
  toolCalls?: unknown;
  usage?: { promptTokens?: unknown; completionTokens?: unknown; totalTokens?: unknown };
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

function parse(body: string | undefined): DoorAnswer {
  try {
    return (JSON.parse(body ?? '') ?? {}) as DoorAnswer;
  } catch {
    return {};
  }
}

/** A refusal, with the provider's status where it had one, so a rate limit reads as one. */
export class LokiKeyError extends Error {
  status: number | null;
  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'LokiKeyError';
    this.status = status;
  }
}

export function lokiKeyService(
  actorId: string,
  provider: string,
  opts: SignedPostOptions = {}
): AiService {
  const chatCompletion: AiService['chatCompletion'] = async ({
    model,
    messages,
    temperature,
    maxTokens,
    tools,
  }) => {
    const res = await askLokiModelDoor(
      actorId,
      {
        do: 'complete',
        vendor: provider,
        // Nothing chosen here: Loki uses the model the person chose there.
        ...(model ? { model } : {}),
        messages,
        temperature,
        ...(maxTokens ? { maxTokens: Math.min(maxTokens, 8192) } : {}),
        ...(tools?.length ? { tools, toolChoice: 'auto' } : {}),
      },
      { timeoutMs: TURN_TIMEOUT_MS, ...opts }
    );
    const answer = parse(res.body);
    if (!res.ok) {
      throw new LokiKeyError(
        text(answer.detail) || `Your ${provider} key on Loki could not be used: ${res.error}`,
        res.status
      );
    }
    if (answer.done !== true) {
      const status = typeof answer.status === 'number' ? answer.status : null;
      throw new LokiKeyError(
        `Your ${provider} key on Loki was refused by the provider${status ? ` (${status})` : ''}: ${
          text(answer.detail) || 'no reason given'
        }`,
        status
      );
    }
    const toolCalls = (Array.isArray(answer.toolCalls) ? answer.toolCalls : []).flatMap(raw => {
      const c = (raw ?? {}) as Record<string, unknown>;
      return typeof c.id === 'string' && typeof c.name === 'string'
        ? [{ id: c.id, name: c.name, arguments: text(c.arguments) || '{}' }]
        : [];
    });
    return {
      content: text(answer.content),
      model: text(answer.model) || model,
      inputTokens: num(answer.usage?.promptTokens),
      outputTokens: num(answer.usage?.completionTokens),
      totalTokens: num(answer.usage?.totalTokens),
      isFreeModel: false,
      usedByok: true,
      costBtc: 0,
      finishReason: text(answer.finishReason) || undefined,
      ...(toolCalls.length ? { toolCalls } : {}),
    };
  };

  return {
    chatCompletion,
    // The door answers whole; a caller that streams gets the answer as one piece.
    async *streamChatCompletion(o) {
      const whole = await chatCompletion(o);
      yield { content: whole.content };
      yield { done: true, usage: { total_tokens: whole.totalTokens } };
    },
  };
}

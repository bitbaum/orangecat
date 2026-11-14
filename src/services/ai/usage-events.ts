/**
 * The Cat's model calls, in the server's one usage log.
 *
 * `@bitbaum/ai-kit` writes a line per model call for every app on the box, so
 * the owner can see who used which vendor ("Is it just one app, or is it all
 * the apps?", 2026-11-13). It can only see calls that go through its own chain
 * walk. The Cat's chat walks its own chain (prompt swap per link, Groq
 * pre-flight, metered primary, a person's own key first), so its calls were
 * missing from that picture: the busiest AI user on the box showed as nothing.
 *
 * Every chat byte the Cat sends ends in one of three clients (groq.ts,
 * openrouter.ts, openai-compat.ts). Each calls `countCalls(this, …)` in its
 * constructor, and from then on reports what came of every call: served,
 * or failed with the vendor's status. Never a prompt, an answer or a key.
 */
import { emitUsage } from '@bitbaum/ai-kit';

import { PROVIDER_BASE_URLS } from '@/config/ai-provider-runtime';

/** The name this app goes by in the log and in ai-kit's spend rules. */
export const AI_APP = 'ORANGECAT';

/** Vendors that bill per call on the platform's key. A person's own key is `byok`, never `paid`. */
const PAID_VENDORS = new Set(['google', 'xai', 'anthropic', 'openai', 'deepseek', 'together']);

export interface ModelCall {
  provider: string;
  model: string;
  byok: boolean;
  outcome: 'served' | 'failed' | 'refused';
  status?: number;
  kind?: string;
  reason?: string;
  inputTokens?: number;
  outputTokens?: number;
  ms?: number;
}

export function recordModelCall(call: ModelCall, now: number = Date.now()): void {
  const { provider, byok, ...rest } = call;
  emitUsage({
    t: now,
    app: process.env.AI_APP_ID?.trim() || AI_APP,
    provider,
    byok,
    paid: !byok && PAID_VENDORS.has(provider),
    ...rest,
  });
}

/** The vendor a chat-completions URL belongs to; the host when it is none we name. */
export function vendorOfEndpoint(url: string): string {
  for (const [id, base] of Object.entries(PROVIDER_BASE_URLS)) {
    if (url.startsWith(base)) {
      return id;
    }
  }
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

/** True when this is a key the server holds (`*_API_KEY` in its environment), not a person's own. */
export function isPlatformKey(
  key: string,
  env: Record<string, string | undefined> = process.env
): boolean {
  const clean = key.trim();
  return (
    clean.length > 0 &&
    Object.entries(env).some(
      ([name, value]) => name.endsWith('_API_KEY') && value?.trim() === clean
    )
  );
}

const statusOf = (err: unknown): number | undefined => {
  const s =
    (err as { statusCode?: unknown; status?: unknown } | null)?.statusCode ??
    (err as { status?: unknown } | null)?.status;
  return typeof s === 'number' ? s : undefined;
};

const tokens = (u: unknown): { inputTokens?: number; outputTokens?: number } => {
  const v = u as { inputTokens?: unknown; outputTokens?: unknown } | null | undefined;
  return {
    ...(typeof v?.inputTokens === 'number' ? { inputTokens: v.inputTokens } : {}),
    ...(typeof v?.outputTokens === 'number' ? { outputTokens: v.outputTokens } : {}),
  };
};

interface Countable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each client declares its own params and result; only `model`, `content` and `usage` are read here
  chatCompletion(params: any): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see chatCompletion
  streamChatCompletion(params: any): AsyncGenerator<any>;
}

/**
 * From now on, every call this client makes is reported. The class's own
 * methods are looked up at call time, so a test that spies on the prototype
 * still sees its spy called.
 */
export function countCalls(
  service: Countable,
  who: { provider: string; byok: boolean; defaultModel?: string }
): void {
  const proto = Object.getPrototypeOf(service) as Countable;
  const modelOf = (params: { model?: string } | undefined) =>
    params?.model || who.defaultModel || 'default';

  service.chatCompletion = async params => {
    const started = Date.now();
    const base = { provider: who.provider, byok: who.byok, model: modelOf(params) };
    try {
      const result = await proto.chatCompletion.call(service, params);
      recordModelCall({ ...base, outcome: 'served', ms: Date.now() - started, ...tokens(result) });
      return result;
    } catch (err) {
      const status = statusOf(err);
      recordModelCall({ ...base, outcome: 'failed', ...(status ? { status } : {}) });
      throw err;
    }
  };

  service.streamChatCompletion = params =>
    (async function* () {
      const started = Date.now();
      const base = { provider: who.provider, byok: who.byok, model: modelOf(params) };
      let sawContent = false;
      let usage: unknown;
      let failure: unknown;
      try {
        for await (const chunk of proto.streamChatCompletion.call(service, params)) {
          if (chunk?.content) {
            sawContent = true;
          }
          if (chunk?.usage) {
            usage = chunk.usage;
          }
          yield chunk;
        }
      } catch (err) {
        failure = err ?? new Error('stream failed');
        throw err;
      } finally {
        // One line per call, whether it finished, broke, or the reader left early.
        // A stream that sent no words did not answer, whatever its status said.
        const status = statusOf(failure);
        recordModelCall(
          sawContent && !failure
            ? { ...base, outcome: 'served', ms: Date.now() - started, ...tokens(usage) }
            : {
                ...base,
                outcome: 'failed',
                ...(status ? { status } : {}),
                ...(failure ? {} : { kind: 'empty' }),
              }
        );
      }
    })();
}

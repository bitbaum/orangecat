import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  completeOnPlatform,
  PlatformChainExhausted,
  type PlatformProvider,
} from '@/services/ai/platform-providers';
import { isLinkDown, resetLinkHealth } from '@/services/ai/link-health';

/**
 * Companions answer on the shared platform chain.
 *
 * They used to pick OpenRouter FIRST — a free tier of 50 requests a day shared
 * by every app on the box — and fall back exactly one hop, to Groq, only on a
 * rate limit. Under real use a companion went silent after a handful of
 * messages while Gemini, which holds this platform's own quota, was never asked.
 */

const ok = (model: string) => ({
  content: `answered by ${model}`,
  model,
  inputTokens: 1,
  outputTokens: 1,
  totalTokens: 2,
  isFreeModel: true,
  usedByok: false,
});

function link(
  providerId: string,
  defaultModel: string,
  behaviour: () => unknown
): PlatformProvider {
  const chatCompletion = vi.fn(async () => behaviour());
  return {
    providerId,
    defaultModel,
    toolEndpoint: '',
    toolKey: '',
    seesImages: 'unknown',
    aiService: { chatCompletion, streamChatCompletion: vi.fn() } as never,
  };
}

const rateLimited = () => {
  throw Object.assign(new Error('429 Too Many Requests'), { status: 429 });
};
const broken = () => {
  throw Object.assign(new Error('upstream 503'), { status: 503 });
};
const tooLarge = () => {
  throw Object.assign(new Error('request too large'), { status: 413 });
};

const req = {
  systemPrompt: 'be kind',
  messages: [{ role: 'user' as const, content: 'hello' }],
  temperature: 0.7,
};

beforeEach(() => resetLinkHealth());

describe('the chain is walked, not abandoned at the first failure', () => {
  it('answers from the first link that works, in chain order', async () => {
    const chain = [link('groq', 'g1', rateLimited), link('google', 'm1', () => ok('m1'))];
    const { result, provider } = await completeOnPlatform('hello', req, chain);
    expect(provider.providerId).toBe('google');
    expect(result.content).toBe('answered by m1');
  });

  it('walks past ANY failure, not only rate limits', async () => {
    const chain = [link('groq', 'g1', broken), link('openrouter', 'o1', () => ok('o1'))];
    const { provider } = await completeOnPlatform('hello', req, chain);
    expect(provider.providerId).toBe('openrouter');
  });

  it('sends the system prompt as the first message, which every vendor accepts', async () => {
    const only = link('google', 'm1', () => ok('m1'));
    await completeOnPlatform('hello', req, [only]);
    const call = (only.aiService.chatCompletion as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.messages[0]).toEqual({ role: 'system', content: 'be kind' });
    expect(call.messages.at(-1)).toEqual({ role: 'user', content: 'hello' });
  });
});

describe('a dead link is remembered, an oversized request is not held against it', () => {
  it('marks a failed link down so the next request skips it', async () => {
    await completeOnPlatform('hello', req, [
      link('groq', 'g1', broken),
      link('google', 'm1', () => ok('m1')),
    ]);
    expect(isLinkDown('groq', 'g1')).toBe(true);
  });

  it('does NOT mark a link down because this prompt was too big for it', async () => {
    await completeOnPlatform('hello', req, [
      link('groq', 'g1', tooLarge),
      link('google', 'm1', () => ok('m1')),
    ]);
    expect(isLinkDown('groq', 'g1')).toBe(false);
  });
});

describe('when every link fails, the reason survives', () => {
  it('reports "rationed" only when every link was rate-limited', async () => {
    const err = await completeOnPlatform('hello', req, [
      link('groq', 'g1', rateLimited),
      link('google', 'm1', rateLimited),
    ]).catch(e => e);
    expect(err).toBeInstanceOf(PlatformChainExhausted);
    expect(err.allRateLimited).toBe(true);
  });

  it('does not call a broken chain "rationed"', async () => {
    const err = await completeOnPlatform('hello', req, [
      link('groq', 'g1', rateLimited),
      link('google', 'm1', broken),
    ]).catch(e => e);
    expect(err.allRateLimited).toBe(false);
  });

  it('says "nothing configured" for an empty chain rather than "every provider failed"', async () => {
    const err = await completeOnPlatform('hello', req, []).catch(e => e);
    expect(err).toBeInstanceOf(PlatformChainExhausted);
    expect(err.failures).toHaveLength(0);
  });
});

describe('the companion send path does not pick a vendor by hand again', () => {
  /**
   * The bug was a hand-written vendor choice inside the send path. A gate on
   * the source keeps the next edit from quietly reintroducing one.
   */
  const src = readFileSync('src/services/ai/sendMessage-internals.ts', 'utf8');

  it('answers platform turns through completeOnPlatform', () => {
    expect(src).toContain('completeOnPlatform(');
  });

  it('never constructs a platform Groq or OpenRouter client itself', () => {
    expect(src).not.toMatch(/createGroqService\s*\(/);
    expect(src).not.toMatch(/createOpenRouterService\s*\(/);
    expect(src).not.toMatch(/process\.env\.(OPENROUTER|GROQ)_API_KEY/);
  });
});

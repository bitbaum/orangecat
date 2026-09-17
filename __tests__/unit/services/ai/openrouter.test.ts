/**
 * OpenRouter cost plumbing — prefer provider-reported usage.cost, fall back to registry.
 */

import { ReadableStream as NodeReadableStream } from 'stream/web';
import { TextDecoder as NodeTextDecoder } from 'util';
import { OpenRouterService } from '@/services/ai/openrouter';
import { calculateCostBtc } from '@/config/ai-models';

import type { MockInstance } from 'vitest';

// @ts-expect-error Jest/node lacks Web TextDecoder
global.TextDecoder = NodeTextDecoder;

const PAID_MODEL = 'deepseek/deepseek-v4-flash';
const FREE_MODEL = 'openai/gpt-oss-20b:free';
const BTC_PRICE_USD = 100_000;

function mockJsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

function mockSseResponse(lines: string[]): Response {
  const stream = new NodeReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(new Uint8Array(Buffer.from(`${line}\n`)));
      }
      controller.close();
    },
  });
  return { ok: true, status: 200, body: stream } as Response;
}

function completionBody(usage: Record<string, unknown>) {
  return {
    id: 'gen-test',
    model: PAID_MODEL,
    choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop', index: 0 }],
    usage,
    created: 0,
  };
}

describe('OpenRouterService chatCompletion cost', () => {
  let fetchSpy: MockInstance;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('uses OpenRouter usage.cost converted to BTC when present', async () => {
    const reportedUsd = 0.01;
    fetchSpy.mockResolvedValue(
      mockJsonResponse(
        completionBody({
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          cost: reportedUsd,
        })
      )
    );

    const svc = new OpenRouterService('sk-test', { btcPriceUsd: BTC_PRICE_USD });
    const result = await svc.chatCompletion({
      model: PAID_MODEL,
      messages: [{ role: 'user', content: 'hi' }],
    });

    const expectedBtc = Math.ceil((reportedUsd / BTC_PRICE_USD) * 1e8) / 1e8;
    expect(result.costBtc).toBe(expectedBtc);
    expect(result.costBtc).not.toBe(calculateCostBtc(PAID_MODEL, 100, 50, BTC_PRICE_USD));
  });

  it('falls back to registry token pricing when usage.cost is absent', async () => {
    fetchSpy.mockResolvedValue(
      mockJsonResponse(
        completionBody({
          prompt_tokens: 1000,
          completion_tokens: 1000,
          total_tokens: 2000,
        })
      )
    );

    const svc = new OpenRouterService('sk-test', { btcPriceUsd: BTC_PRICE_USD });
    const result = await svc.chatCompletion({
      model: PAID_MODEL,
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(result.costBtc).toBe(calculateCostBtc(PAID_MODEL, 1000, 1000, BTC_PRICE_USD));
  });

  it('never bills free models even when OpenRouter returns a positive usage.cost', async () => {
    fetchSpy.mockResolvedValue(
      mockJsonResponse({
        ...completionBody({
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          cost: 0.05,
        }),
        model: FREE_MODEL,
      })
    );

    const svc = new OpenRouterService('sk-test', { btcPriceUsd: BTC_PRICE_USD });
    const result = await svc.chatCompletion({
      model: FREE_MODEL,
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(result.costBtc).toBe(0);
    expect(result.isFreeModel).toBe(true);
  });
});

describe('OpenRouterService streamChatCompletion cost', () => {
  let fetchSpy: MockInstance;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('includes costBtc on the final usage chunk when streaming', async () => {
    const reportedUsd = 0.02;
    fetchSpy.mockResolvedValue(
      mockSseResponse([
        'data: {"choices":[{"delta":{"content":"Hi"},"finish_reason":null,"index":0}]}',
        `data: {"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15,"cost":${reportedUsd}}}`,
        'data: [DONE]',
      ])
    );

    const svc = new OpenRouterService('sk-test', { btcPriceUsd: BTC_PRICE_USD });
    let finalUsage: { costBtc?: number } | undefined;

    for await (const chunk of svc.streamChatCompletion({
      model: PAID_MODEL,
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      if (chunk.done && chunk.usage) {
        finalUsage = chunk.usage;
      }
    }

    const expectedBtc = Math.ceil((reportedUsd / BTC_PRICE_USD) * 1e8) / 1e8;
    expect(finalUsage?.costBtc).toBe(expectedBtc);
  });
});

describe('OpenRouterService sampling-param gating', () => {
  let fetchSpy: MockInstance;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function sentBody(): Record<string, unknown> {
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    return JSON.parse(init.body as string);
  }

  it('omits temperature for models with supportsTemperature=false', async () => {
    fetchSpy.mockResolvedValue(
      mockJsonResponse(completionBody({ prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }))
    );

    const svc = new OpenRouterService('sk-test', { btcPriceUsd: BTC_PRICE_USD });
    await svc.chatCompletion({
      model: 'anthropic/claude-opus-5',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.2,
    });

    expect(sentBody()).not.toHaveProperty('temperature');
  });

  it('keeps temperature for models without the flag', async () => {
    fetchSpy.mockResolvedValue(
      mockJsonResponse(completionBody({ prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }))
    );

    const svc = new OpenRouterService('sk-test', { btcPriceUsd: BTC_PRICE_USD });
    await svc.chatCompletion({
      model: PAID_MODEL,
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.2,
    });

    expect(sentBody()).toHaveProperty('temperature', 0.2);
  });
});

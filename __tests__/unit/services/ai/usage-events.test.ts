/**
 * The Cat's model calls reach the server's usage log (src/services/ai/usage-events.ts).
 *
 * Guards: on 2026-11-13 the fleet's AI picture listed Solon and Loki and not
 * OrangeCat, because the Cat walks its own chain and reported nothing.
 */
import { vi } from 'vitest';

import { setUsageSink, type UsageEvent } from '@bitbaum/ai-kit';

import {
  countCalls,
  isPlatformKey,
  recordModelCall,
  vendorOfEndpoint,
} from '@/services/ai/usage-events';
import { cappedService, VendorCapReached } from '@/services/ai/vendor-spend-cap';

let seen: UsageEvent[] = [];

beforeEach(() => {
  seen = [];
  setUsageSink(e => {
    seen.push(e);
  });
});
afterEach(() => {
  setUsageSink(null);
});

class FakeClient {
  constructor(private readonly mode: 'ok' | 'fail' | 'empty' | 'break') {
    countCalls(this, { provider: 'groq', byok: false, defaultModel: 'fallback-model' });
  }
  async chatCompletion(_params: { model?: string }) {
    if (this.mode === 'fail') {
      throw Object.assign(new Error('rate limited'), { statusCode: 429 });
    }
    return { content: 'secret answer', inputTokens: 12, outputTokens: 5 };
  }
  async *streamChatCompletion(_params: { model?: string }) {
    if (this.mode === 'fail') {
      throw Object.assign(new Error('gone'), { statusCode: 503 });
    }
    if (this.mode !== 'empty') {
      yield { content: 'secret ' };
    }
    if (this.mode === 'break') {
      throw new Error('socket closed');
    }
    yield { content: '', done: true, usage: { inputTokens: 30, outputTokens: 9 } };
  }
}

const drain = async (it: AsyncIterable<unknown>) => {
  for await (const _ of it) {
    // read to the end
  }
};

describe('countCalls', () => {
  it('reports a served call with the app, vendor, model and tokens, never the answer', async () => {
    await new FakeClient('ok').chatCompletion({ model: 'llama' });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      app: 'ORANGECAT',
      provider: 'groq',
      model: 'llama',
      outcome: 'served',
      paid: false,
      byok: false,
      inputTokens: 12,
      outputTokens: 5,
    });
    expect(JSON.stringify(seen)).not.toContain('secret');
  });

  it('reports a failed call with the vendor status and still throws it', async () => {
    await expect(new FakeClient('fail').chatCompletion({})).rejects.toThrow('rate limited');
    expect(seen[0]).toMatchObject({ outcome: 'failed', status: 429, model: 'fallback-model' });
  });

  it('reports a stream once, when it ends, with the final usage', async () => {
    await drain(new FakeClient('ok').streamChatCompletion({ model: 'm' }));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ outcome: 'served', inputTokens: 30, outputTokens: 9 });
  });

  it('a stream that sent no words did not answer', async () => {
    await drain(new FakeClient('empty').streamChatCompletion({ model: 'm' }));
    expect(seen[0]).toMatchObject({ outcome: 'failed', kind: 'empty' });
  });

  it('a stream refused or broken mid-answer is failed, once', async () => {
    await expect(drain(new FakeClient('fail').streamChatCompletion({}))).rejects.toThrow('gone');
    await expect(drain(new FakeClient('break').streamChatCompletion({}))).rejects.toThrow(
      'socket closed'
    );
    expect(seen.map(e => [e.outcome, e.status])).toEqual([
      ['failed', 503],
      ['failed', undefined],
    ]);
  });

  it('a reader who leaves early still gets one line', async () => {
    for await (const _ of new FakeClient('ok').streamChatCompletion({ model: 'm' })) {
      break;
    }
    expect(seen).toHaveLength(1);
    expect(seen[0].outcome).toBe('served');
  });
});

describe('recordModelCall', () => {
  it('marks a billing vendor paid on the platform key and never on a person’s own key', () => {
    recordModelCall({ provider: 'xai', model: 'grok', byok: false, outcome: 'served' });
    recordModelCall({ provider: 'xai', model: 'grok', byok: true, outcome: 'served' });
    expect(seen.map(e => [e.paid, e.byok])).toEqual([
      [true, false],
      [false, true],
    ]);
  });
});

describe('where a tool step went', () => {
  it('names the vendor from its endpoint', () => {
    expect(vendorOfEndpoint('https://api.groq.com/openai/v1/chat/completions')).toBe('groq');
    expect(vendorOfEndpoint('https://openrouter.ai/api/v1/chat/completions')).toBe('openrouter');
    expect(vendorOfEndpoint('http://127.0.0.1:11434/v1/chat/completions')).toBe('127.0.0.1');
    expect(vendorOfEndpoint('not a url')).toBe('unknown');
  });

  it('tells the server’s key from a person’s', () => {
    const env = { GROQ_API_KEY: 'gsk_platform', OTHER: 'gsk_person' };
    expect(isPlatformKey('gsk_platform', env)).toBe(true);
    expect(isPlatformKey('gsk_person', env)).toBe(false);
    expect(isPlatformKey('', env)).toBe(false);
  });
});

describe('a call the daily cap stopped', () => {
  it('is reported as not called, and the cap error still reaches the chain', async () => {
    const inner = {
      chatCompletion: vi.fn(),
      streamChatCompletion: vi.fn(),
    };
    const env = { GROQ_API_KEY: 'gsk-platform' };
    const capped = cappedService(inner as never, 'gsk-platform', env, async () => false);
    await expect(
      capped.chatCompletion({ model: 'llama', messages: [], temperature: 0 })
    ).rejects.toBeInstanceOf(VendorCapReached);
    expect(inner.chatCompletion).not.toHaveBeenCalled();
    expect(seen[0]).toMatchObject({ outcome: 'refused', reason: 'vendor-cap', model: 'llama' });
  });
});

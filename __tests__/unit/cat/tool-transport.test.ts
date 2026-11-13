import { describe, expect, it, vi } from 'vitest';
import { LokiKeyError } from '@/services/ai/loki-key-service';
import { chosenFirst } from '@/services/cat/model-access';
import {
  asProviderAnswer,
  lokiToolKey,
  parseLokiToolKey,
  postToolStep,
} from '@/services/cat/tool-transport';

/**
 * The Cat's tool loop on a key the person keeps on Loki. Seen live on
 * 2026-11-13: the answer came from the owner's Grok while the tool calls
 * went to the spent free pool, and "check my calendar" ended as "that check
 * stopped before it finished". A step on such a key goes through Loki.
 */
describe('a tool step on a key kept on Loki', () => {
  const request = {
    toolEndpoint: 'https://loki.example/api/orangecat/model',
    toolKey: lokiToolKey('actor-1', 'xai'),
    model: 'grok-test',
    messages: [{ role: 'user', content: 'What is on my calendar?' }],
    tools: [{ type: 'function', function: { name: 'calendar_read' } }],
    maxTokens: 1200,
    signal: new AbortController().signal,
  };

  it('names whose key and which provider, and is not mistaken for a bearer key', () => {
    expect(parseLokiToolKey(request.toolKey)).toEqual({ provider: 'xai', actorId: 'actor-1' });
    expect(parseLokiToolKey('xai-realkey')).toBeNull();
    expect(parseLokiToolKey(null)).toBeNull();
    expect(parseLokiToolKey('loki-door:xai:')).toBeNull();
  });

  it('asks Loki, with the tools, and never sends the marker anywhere as a key', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const chatCompletion = vi.fn(async () => ({
      content: '',
      model: 'grok-test',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      isFreeModel: false,
      usedByok: true,
      toolCalls: [{ id: 'c1', name: 'calendar_read', arguments: '{"days":7}' }],
    }));
    const viaLoki = vi.fn(() => ({ chatCompletion, streamChatCompletion: vi.fn() }));
    const answer = await postToolStep(request, viaLoki as never);
    expect(viaLoki).toHaveBeenCalledWith('actor-1', 'xai');
    expect(chatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'grok-test', tools: request.tools, maxTokens: 1200 })
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(answer).toMatchObject({ ok: true });
    const choice = (answer as { data: { choices: Array<Record<string, unknown>> } }).data
      .choices[0];
    expect(choice.finish_reason).toBe('tool_calls');
    expect(choice.message).toMatchObject({
      tool_calls: [
        {
          id: 'c1',
          type: 'function',
          function: { name: 'calendar_read', arguments: '{"days":7}' },
        },
      ],
    });
    vi.unstubAllGlobals();
  });

  it('reads an answer with no tool call as the model being done', () => {
    const data = asProviderAnswer({ content: 'Nothing to look up.', finishReason: 'stop' }) as {
      choices: Array<{ finish_reason: string; message: { tool_calls?: unknown } }>;
    };
    expect(data.choices[0].finish_reason).toBe('stop');
    expect(data.choices[0].message.tool_calls).toBeUndefined();
  });

  it('reports a refusal with the provider’s status, so a rate limit reads as one', async () => {
    const viaLoki = () => ({
      chatCompletion: async () => {
        throw new LokiKeyError('rate limited', 429);
      },
      streamChatCompletion: vi.fn(),
    });
    expect(await postToolStep(request, viaLoki as never)).toEqual({
      ok: false,
      status: 429,
      bodyText: 'rate limited',
    });
  });

  it('still posts straight to the provider for a key that is here', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ a: 1 }) }));
    vi.stubGlobal('fetch', fetchSpy);
    const answer = await postToolStep({
      ...request,
      toolEndpoint: 'https://api.x.ai/v1/chat/completions',
      toolKey: 'xai-realkey',
    });
    expect(answer).toEqual({ ok: true, status: 200, data: { a: 1 } });
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.x.ai/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer xai-realkey');
    vi.unstubAllGlobals();
  });
});

describe('the order of a key’s models in the menu', () => {
  it('puts the model chosen in Loki first, then the rest by name, higher numbers on top', () => {
    expect(chosenFirst(['grok-4.3', 'grok-4.7', 'grok-4.5', 'grok-4.6'], 'grok-4.6')).toEqual([
      'grok-4.6',
      'grok-4.7',
      'grok-4.5',
      'grok-4.3',
    ]);
    expect(chosenFirst(['grok-4.3', 'grok-4.7'], null)).toEqual(['grok-4.7', 'grok-4.3']);
    expect(chosenFirst(['grok-4.3'], 'not-listed')).toEqual(['grok-4.3']);
  });
});

/**
 * Bare-URL message path through the Cat tool loop (prod bug repro: sending
 * exactly "revampit.orangecat.ch" hung the chat — no tool chip, no reply).
 *
 * Covers:
 * - a URL-only message deterministically pre-seeds analyze_website (no
 *   reliance on the weak routing model deciding to call it)
 * - the tool phase NEVER hangs or throws: a throwing tool and a
 *   never-resolving tool both degrade to a resolved messages array carrying
 *   an honest "couldn't fetch the site" note for the main model
 * - late callbacks after the tool-phase timeout are suppressed
 */
import { maybeEnrichWithSearchResults } from '@/services/cat/tool-use';
import { executeToolCall } from '@/services/cat/tool-executor';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { RawToolCall, ToolAugmentedMessage } from '@/services/cat/tool-use-types';

import type { MockedFunction } from 'vitest';

vi.mock('@/services/cat/tool-executor', () => ({
  executeToolCall: vi.fn(),
}));

const mockExecuteToolCall = executeToolCall as MockedFunction<typeof executeToolCall>;

const supabase = {} as AnySupabaseClient;
const USER_ID = 'user-1';
const BARE_DOMAIN_MESSAGE = 'revampit.orangecat.ch';

const baseMessages: ToolAugmentedMessage[] = [
  { role: 'system', content: 'system prompt' },
  { role: 'user', content: BARE_DOMAIN_MESSAGE },
];

/** Routing-model response that calls no further tools (finish_reason: stop). */
function stopResponse() {
  return {
    ok: true,
    json: async () => ({
      choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '' } }],
    }),
  } as unknown as Response;
}

function enrich(
  message: string,
  overrides?: {
    onToolCall?: (event: unknown) => void;
    timeoutMs?: number;
  }
) {
  return maybeEnrichWithSearchResults(
    supabase,
    USER_ID,
    [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: message },
    ],
    message,
    'groq',
    'test-model',
    overrides?.onToolCall as never,
    undefined,
    {
      // Production always supplies these — the resolver owns the active
      // step's endpoint and key. A caller without them now gets no tools,
      // which is the point: the loop never guesses a vendor.
      toolEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
      toolKey: 'test-key',
      ...(overrides?.timeoutMs !== undefined ? { timeoutMs: overrides.timeoutMs } : {}),
    }
  );
}

describe('maybeEnrichWithSearchResults — bare-URL message', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(async () => stopResponse()) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('pre-seeds analyze_website programmatically for a message that is only a bare domain', async () => {
    mockExecuteToolCall.mockImplementation(async (_sb, _uid, toolCall) => ({
      role: 'tool',
      tool_call_id: (toolCall as RawToolCall).id,
      content: 'WEBSITE CONTENT fetched from https://revampit.orangecat.ch/: ...',
    }));

    const result = await enrich(BARE_DOMAIN_MESSAGE);

    // The tool ran even though the routing model never emitted a tool_call.
    expect(mockExecuteToolCall).toHaveBeenCalledTimes(1);
    const [, , toolCall, userMessage] = mockExecuteToolCall.mock.calls[0];
    expect((toolCall as RawToolCall).function.name).toBe('analyze_website');
    expect(JSON.parse((toolCall as RawToolCall).function.arguments)).toEqual({
      url: 'https://revampit.orangecat.ch/',
    });
    expect(userMessage).toBe(BARE_DOMAIN_MESSAGE);

    // The enriched thread carries the assistant tool_call + the tool result,
    // so the main model answers grounded in the fetched site text.
    expect(result).toHaveLength(baseMessages.length + 2);
    expect(result[2]).toMatchObject({
      role: 'assistant',
      tool_calls: [
        expect.objectContaining({ function: expect.objectContaining({ name: 'analyze_website' }) }),
      ],
    });
    expect(result[3]).toMatchObject({
      role: 'tool',
      content: expect.stringContaining('WEBSITE CONTENT'),
    });
  });

  it('does not pre-seed for a message that merely contains a URL mid-sentence', async () => {
    await enrich('can you analyze revampit.orangecat.ch for me');
    // The tool pass runs (intent + URL), but analyze_website is only invoked
    // when the routing model asks for it — here it returned finish_reason=stop.
    expect(mockExecuteToolCall).not.toHaveBeenCalled();
  });

  it('degrades to an honest note when the tool throws — the flow still completes', async () => {
    mockExecuteToolCall.mockRejectedValue(new Error('boom'));

    const result = await enrich(BARE_DOMAIN_MESSAGE);

    // Resolved (no throw, no hang) with the original messages plus a system
    // note instructing the model to tell the user the site couldn't be read.
    expect(result).toHaveLength(baseMessages.length + 1);
    expect(result[result.length - 1]).toMatchObject({
      role: 'system',
      content: expect.stringContaining('could not be fetched'),
    });
  });

  it('resolves within the hard timeout when the tool phase hangs forever', async () => {
    // Never-resolving tool execution — before the fix this hung the SSE
    // stream before its first byte.
    mockExecuteToolCall.mockImplementation(() => new Promise(() => {}));
    const events: unknown[] = [];

    const result = await enrich(BARE_DOMAIN_MESSAGE, {
      onToolCall: e => events.push(e),
      timeoutMs: 50,
    });

    expect(result[result.length - 1]).toMatchObject({
      role: 'system',
      content: expect.stringContaining('could not be fetched'),
    });

    // Late callbacks from the orphaned loop are suppressed after the timeout.
    const eventsAtTimeout = events.length;
    await new Promise(r => setTimeout(r, 20));
    expect(events.length).toBe(eventsAtTimeout);
  });

  it('returns messages unchanged when the routing provider errors on a non-URL message', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const result = await enrich('help me find a designer');
    expect(result).toEqual([
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'help me find a designer' },
    ]);
    expect(mockExecuteToolCall).not.toHaveBeenCalled();
  });
});

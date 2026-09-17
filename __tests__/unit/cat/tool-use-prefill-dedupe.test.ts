/**
 * Cross-step prefill dedupe in the Cat tool loop.
 *
 * Prod bug: weak routing models re-called prefill_entity_form for the SAME
 * entity type after seeing its result, so the user got two identical draft
 * cards ("Haircuts at home in Zürich" twice). A repeat of an already-drafted
 * type in a later step must be dropped; distinct types (and same-step
 * multiples, used by the website flow) stay allowed.
 */
import { maybeEnrichWithSearchResults } from '@/services/cat/tool-use';
import { executeToolCall } from '@/services/cat/tool-executor';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { RawToolCall } from '@/services/cat/tool-use-types';

import type { MockedFunction } from 'vitest';

vi.mock('@/services/cat/tool-executor', () => ({
  executeToolCall: vi.fn(),
}));

const mockExecuteToolCall = executeToolCall as MockedFunction<typeof executeToolCall>;

const supabase = {} as AnySupabaseClient;
const USER_ID = 'user-1';
// Message with create intent so the tool pass runs ("i offer" trigger).
const MESSAGE = 'I offer haircuts at home in Zürich, 40 CHF';

function prefillCall(id: string, entityType: string): RawToolCall {
  return {
    id,
    type: 'function',
    function: {
      name: 'prefill_entity_form',
      arguments: JSON.stringify({ entityType, description: `a ${entityType} the user described` }),
    },
  };
}

function toolCallsResponse(calls: RawToolCall[]) {
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          finish_reason: 'tool_calls',
          message: { role: 'assistant', content: null, tool_calls: calls },
        },
      ],
    }),
  } as unknown as Response;
}

function stopResponse() {
  return {
    ok: true,
    json: async () => ({
      choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '' } }],
    }),
  } as unknown as Response;
}

function enrich() {
  return maybeEnrichWithSearchResults(
    supabase,
    USER_ID,
    [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: MESSAGE },
    ],
    MESSAGE,
    'groq',
    'test-model',
    undefined,
    undefined,
    {
      // Production always supplies these — the resolver owns the active
      // step's endpoint and key. A caller without them now gets no tools,
      // which is the point: the loop never guesses a vendor.
      toolEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
      toolKey: 'test-groq-key',
    }
  );
}

describe('tool loop — cross-step prefill dedupe', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteToolCall.mockImplementation(async (_sb, _uid, toolCall) => ({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: 'Drafted.',
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('drops a later-step prefill for an entity type already drafted', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(toolCallsResponse([prefillCall('call_1', 'service')]))
      .mockResolvedValueOnce(toolCallsResponse([prefillCall('call_2', 'service')]))
      .mockResolvedValue(stopResponse()) as unknown as typeof fetch;

    await enrich();

    expect(mockExecuteToolCall).toHaveBeenCalledTimes(1);
    expect(mockExecuteToolCall.mock.calls[0][2].id).toBe('call_1');
  });

  it('still allows a DIFFERENT entity type in a later step', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(toolCallsResponse([prefillCall('call_1', 'service')]))
      .mockResolvedValueOnce(toolCallsResponse([prefillCall('call_2', 'product')]))
      .mockResolvedValue(stopResponse()) as unknown as typeof fetch;

    await enrich();

    expect(mockExecuteToolCall).toHaveBeenCalledTimes(2);
    const executedTypes = mockExecuteToolCall.mock.calls.map(
      c => (JSON.parse(c[2].function.arguments) as { entityType: string }).entityType
    );
    expect(executedTypes).toEqual(['service', 'product']);
  });

  it('keeps same-step multiples (the website flow chains several in one message)', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        toolCallsResponse([prefillCall('call_1', 'service'), prefillCall('call_2', 'product')])
      )
      .mockResolvedValue(stopResponse()) as unknown as typeof fetch;

    await enrich();

    expect(mockExecuteToolCall).toHaveBeenCalledTimes(2);
  });
});

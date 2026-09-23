import { maybeEnrichWithSearchResults } from '@/services/cat/tool-use';
import { executeToolCall } from '@/services/cat/tool-executor';
import { toolRoutingHistory } from '@/services/cat/tool-turn-state';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { OnToolCall, RawToolCall, ToolAugmentedMessage } from '@/services/cat/tool-use-types';

vi.mock('@/services/cat/tool-executor', () => ({ executeToolCall: vi.fn() }));
const execute = vi.mocked(executeToolCall);
const call = (id: string): RawToolCall => ({
  id,
  type: 'function',
  function: { name: 'query_my_data', arguments: '{}' },
});
const response = (calls: RawToolCall[]) => ({
  ok: true,
  status: 200,
  json: async () => ({
    choices: [
      {
        finish_reason: 'tool_calls',
        message: { role: 'assistant', content: null, tool_calls: calls },
      },
    ],
  }),
});
const messages: ToolAugmentedMessage[] = [
  { role: 'user', content: 'Check my listings and earnings' },
];
const run = (onToolCall?: OnToolCall) =>
  maybeEnrichWithSearchResults(
    {} as AnySupabaseClient,
    'test',
    messages,
    'Check my listings and earnings',
    'groq',
    'test-reliability-model',
    onToolCall,
    undefined,
    { toolEndpoint: 'https://example.com/chat', toolKey: 'test', timeoutMs: 100 }
  );

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('routes follow-ups with bounded dialogue, never the large system prompt or orphan tool messages', () => {
  const history = toolRoutingHistory(
    [
      { role: 'system', content: 'private routing rules' },
      { role: 'user', content: 'I sell handmade mugs for 40 CHF' },
      { role: 'assistant', content: 'Would you like a product draft?' },
      { role: 'tool', tool_call_id: 'old', content: 'payload' },
      { role: 'user', content: 'Yes, draft that' },
    ],
    'Yes, draft that'
  );
  expect(history).toEqual([
    { role: 'user', content: 'I sell handmade mugs for 40 CHF' },
    { role: 'assistant', content: 'Would you like a product draft?' },
  ]);
  expect(
    toolRoutingHistory(
      Array.from({ length: 20 }, () => ({ role: 'user', content: 'x'.repeat(9000) })),
      'new'
    )
  ).toHaveLength(8);
});

it('retains completed results and aborts the provider at the single turn deadline', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response([call('first')]))
    .mockImplementation(() => new Promise(() => {}));
  vi.stubGlobal('fetch', fetcher);
  execute.mockResolvedValue({
    role: 'tool',
    tool_call_id: 'first',
    content: 'Verified: 3 listings',
  });
  const pending = run();
  await vi.advanceTimersByTimeAsync(101);
  const result = await pending;
  expect(result).toContainEqual({
    role: 'tool',
    tool_call_id: 'first',
    content: 'Verified: 3 listings',
  });
  expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true);
  expect(result.at(-1)?.content).toContain('unfinished');
});

it('uses a configured fallback when the primary has no tool endpoint', async () => {
  const fetcher = vi.fn().mockResolvedValue(response([]));
  vi.stubGlobal('fetch', fetcher);
  await maybeEnrichWithSearchResults(
    {} as AnySupabaseClient,
    'test',
    messages,
    'Check my listings and earnings',
    'primary',
    'primary-model',
    undefined,
    undefined,
    {
      toolFallbacks: [
        {
          modelToUse: 'fallback-model',
          toolEndpoint: 'https://fallback.test/chat',
          toolKey: 'fallback-key',
        },
      ],
    }
  );
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls[0][0]).toBe('https://fallback.test/chat');
  expect(JSON.parse(fetcher.mock.calls[0][1].body).model).toBe('fallback-model');
});

it('does not execute the remaining action batch after a timed-out tool completes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([call('slow'), call('must-not-run')])));
  let finish!: (value: Awaited<ReturnType<typeof executeToolCall>>) => void;
  execute.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const onToolCall = vi.fn();
  const pending = run(onToolCall);
  await vi.advanceTimersByTimeAsync(101);
  const result = await pending;
  expect(result.at(-1)?.content).toContain('unconfirmed');
  expect(onToolCall).toHaveBeenCalledWith({
    id: 'slow',
    name: 'query_my_data',
    status: 'unconfirmed',
  });
  finish({ role: 'tool', tool_call_id: 'slow', content: 'late success' });
  await vi.advanceTimersByTimeAsync(1);
  expect(execute).toHaveBeenCalledTimes(1);
  expect(result.some(m => m.content === 'late success')).toBe(false);
});

it('retains earlier evidence when a later tool throws, without dangling tool calls', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([call('good'), call('bad')])));
  execute
    .mockResolvedValueOnce({ role: 'tool', tool_call_id: 'good', content: 'Verified result' })
    .mockRejectedValueOnce(new Error('offline'));
  const result = await run();
  const offered = result.flatMap(m => ('tool_calls' in m ? m.tool_calls.map(c => c.id) : []));
  const answered = result.flatMap(m => (m.role === 'tool' ? [m.tool_call_id] : []));
  expect(offered).toEqual(['good']);
  expect(answered).toEqual(offered);
  expect(result.at(-1)?.content).toContain('unconfirmed');
});

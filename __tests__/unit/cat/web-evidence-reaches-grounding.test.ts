/**
 * Web evidence has to reach the grounding check, and only when Cat really read it.
 *
 * Two failures this guards, and they pull in opposite directions.
 *
 * If the evidence never arrives, the citation handles are decorative: the
 * verifier sees "240 CHF" in a reply, finds it in none of the evidence it was
 * given, calls it a novel number, and the repair pass DELETES the one
 * researched figure in the answer. Correct research would be punished as
 * invention.
 *
 * If the evidence arrives when Cat never actually saw it — the tool phase died
 * on its deadline, so the model was handed no web content at all — then any
 * sentence that happens to share words with a page we fetched but never showed
 * gets licensed. That is the same bug pointing the other way: invention passing
 * as research.
 *
 * So: fires on the path where tool results reach the model, and not on the
 * degrade path.
 */
import { maybeEnrichWithSearchResults } from '@/services/cat/tool-use';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { ToolAugmentedMessage } from '@/services/cat/tool-use-types';

const supabase = {} as AnySupabaseClient;
const USER_ID = 'user-1';

const baseMessages: ToolAugmentedMessage[] = [
  { role: 'system', content: 'system' },
  { role: 'user', content: 'what does a coworking desk cost in Zurich?' },
];

const realFetch = global.fetch;
const realEnv = { ...process.env };

/**
 * The routing model asks for one web_search, then stops. Everything the search
 * itself does is mocked at the ai-kit seam below.
 */
function routerCalling(toolName: string, args: Record<string, unknown>) {
  let step = 0;
  return vi.fn(async () => {
    step += 1;
    if (step === 1) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              finish_reason: 'tool_calls',
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: { name: toolName, arguments: JSON.stringify(args) },
                  },
                ],
              },
            },
          ],
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'ok' } }],
      }),
    };
  });
}

const mocks = vi.hoisted(() => ({ webSearch: vi.fn(), readPage: vi.fn() }));

vi.mock('@bitbaum/ai-kit/web', async importOriginal => {
  const actual = await importOriginal<typeof import('@bitbaum/ai-kit/web')>();
  return { ...actual, webSearch: mocks.webSearch, readPage: mocks.readPage };
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENROUTER_API_KEY = 'test-key';
});

afterEach(() => {
  global.fetch = realFetch;
  process.env = { ...realEnv };
});

it('hands the grounding check what Cat actually read', async () => {
  mocks.webSearch.mockResolvedValue({
    status: 'found',
    provider: 'searxng',
    query: 'coworking desk price zurich',
    results: [
      {
        title: 'Zurich coworking prices',
        url: 'https://example.com/prices',
        snippet: 'Desks from 240 CHF per month.',
      },
    ],
    attempts: [{ provider: 'searxng', outcome: 'results', count: 1 }],
  });
  global.fetch = routerCalling('web_search', {
    query: 'coworking desk price zurich',
  }) as unknown as typeof fetch;

  const evidence: string[] = [];
  const enriched = await maybeEnrichWithSearchResults(
    supabase,
    USER_ID,
    baseMessages,
    'what does a coworking desk cost in Zurich?',
    'openrouter',
    null,
    'some-model',
    undefined,
    undefined,
    { onWebEvidence: e => evidence.push(...e) }
  );

  // The tool result really did reach the model...
  expect(enriched.length).toBeGreaterThan(baseMessages.length);
  // ...and the same source reached the verifier, under a citation handle.
  expect(evidence).toHaveLength(1);
  expect(evidence[0]).toMatch(/^\[F1\]/);
  expect(evidence[0]).toMatch(/240 CHF/);
  expect(evidence[0]).toMatch(/https:\/\/example\.com\/prices/);
});

it('hands over nothing when the tool phase died before the model saw anything', async () => {
  mocks.webSearch.mockImplementation(
    () => new Promise(() => {}) // never resolves — the phase deadline wins
  );
  global.fetch = routerCalling('web_search', { query: 'q' }) as unknown as typeof fetch;

  const evidence: string[] = [];
  const enriched = await maybeEnrichWithSearchResults(
    supabase,
    USER_ID,
    baseMessages,
    'what does a coworking desk cost in Zurich?',
    'openrouter',
    null,
    'some-model',
    undefined,
    undefined,
    { timeoutMs: 60, onWebEvidence: e => evidence.push(...e) }
  );

  expect(evidence).toEqual([]);
  // And the model is told it was about to look something up and did not, so it
  // cannot quietly answer a current-price question from its weights.
  const note = enriched.map(m => ('content' in m ? String(m.content ?? '') : '')).join('\n');
  expect(note).toMatch(/did not finish/i);
  expect(note).toMatch(/have NOT seen any web content/i);
});

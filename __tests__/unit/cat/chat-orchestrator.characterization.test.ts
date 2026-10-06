/**
 * orchestrateCatChat — characterization tests.
 *
 * Drive the whole orchestrator through its real control flow — provider
 * fallback, pre-flight skips, the streaming SSE protocol, grounding repair,
 * persistence, metering, and the honest error ending — with every external
 * collaborator mocked at its module boundary. What it emits (SSE frames, the
 * JSON body) and what it calls (saves, link-down marks, meters, alerts) is
 * recorded and pinned. The snapshots were taken from the 1,011-line
 * pre-split orchestrator; the split must reproduce them exactly.
 *
 * Kept real, because they are part of the behaviour being pinned:
 * parseActionsFromResponse, withImages / withImageRefs, buildFailedTurnMessages,
 * EmptyCompletion / hasUsableContent, isAgenticModel, messageMightNeedTools,
 * actionsViaForModel, applyRateLimitHeaders, apiSuccess.
 */

import type { Mock } from 'vitest';
import { orchestrateCatChat, type CatChatBody } from '@/services/cat/chat-orchestrator';
import { resolveProvider } from '@/services/cat/provider-resolver';
import { prepareCatChat } from '@/services/cat/chat-prepare';
import { maybeEnrichWithSearchResults } from '@/services/cat/tool-use';
import { enforceGrounding } from '@/services/cat/grounding';
import { runExecActions } from '@/services/cat/exec-actions';
import { saveMessages } from '@/services/cat/conversation-history';
import { extractAndStoreMemories } from '@/services/cat/memory';
import { extractAndStoreEconomicProfile } from '@/services/cat/economic-profile';
import { meterCreditUsage } from '@/services/cat/credit-metering';
import { alertCatChatFailure } from '@/services/cat/failure-alert';
import { markLinkDown } from '@/services/ai/link-health';
import {
  getGroqTpmLimit,
  isGroqDailyPoolSpent,
  recordOpenRouterRateLimit,
} from '@/services/ai/groq-capacity';
import { promptFitsGroqOnDemand } from '@/services/ai/groq';
import { storeChatImages } from '@/services/cat/chat-image-store';
import { getUserActorId } from '@/domain/actors';
import { logger } from '@/utils/logger';
import type { AuthenticatedRequest } from '@/lib/api/withAuth';
import type { RateLimitResult } from '@/lib/rate-limit';

// The suite aliases next/server to a stub (vitest.config.ts); apiSuccess needs
// the real NextResponse for the non-streaming body.
vi.mock('next/server', async () => ({
  NextRequest: (await import('next/dist/server/web/spec-extension/request')).NextRequest,
  NextResponse: (await import('next/dist/server/web/spec-extension/response')).NextResponse,
}));
vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/services/cat/provider-resolver', () => ({ resolveProvider: vi.fn() }));
vi.mock('@/services/cat/chat-prepare', () => ({ prepareCatChat: vi.fn() }));
vi.mock('@/services/cat/tool-use', () => ({ maybeEnrichWithSearchResults: vi.fn() }));
vi.mock('@/services/cat/grounding', () => ({ enforceGrounding: vi.fn() }));
vi.mock('@/services/cat/exec-actions', () => ({ runExecActions: vi.fn() }));
vi.mock('@/services/cat/conversation-history', () => ({ saveMessages: vi.fn() }));
vi.mock('@/services/cat/memory', () => ({ extractAndStoreMemories: vi.fn() }));
vi.mock('@/services/cat/economic-profile', () => ({ extractAndStoreEconomicProfile: vi.fn() }));
vi.mock('@/services/cat/credit-metering', () => ({ meterCreditUsage: vi.fn() }));
vi.mock('@/services/cat/failure-alert', () => ({ alertCatChatFailure: vi.fn() }));
vi.mock('@/services/ai/link-health', () => ({ markLinkDown: vi.fn() }));
vi.mock('@/services/ai/groq-capacity', async () => ({
  ...((await vi.importActual('@/services/ai/groq-capacity')) as object),
  getGroqTpmLimit: vi.fn(),
  isGroqDailyPoolSpent: vi.fn(),
  recordOpenRouterRateLimit: vi.fn(),
}));
vi.mock('@/services/ai/groq', async () => ({
  ...((await vi.importActual('@/services/ai/groq')) as object),
  promptFitsGroqOnDemand: vi.fn(),
}));
vi.mock('@/services/cat/chat-image-store', () => ({ storeChatImages: vi.fn() }));
vi.mock('@/domain/actors', () => ({ getUserActorId: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn(() => ({ _kind: 'admin' })) }));

const USER = '11111111-1111-4111-8111-111111111111';
const CONV = '99999999-9999-4999-8999-999999999999';
const SUPABASE = { _kind: 'session' };
const RL: RateLimitResult = {
  success: true,
  limit: 30,
  remaining: 29,
  resetTime: 1_900_000_000_000,
};

// ---------- scripted AI services ----------

type StreamScript =
  | { chunks: Array<{ content?: string; usage?: unknown; done?: boolean }> }
  | { throws: unknown }
  | { throwsAfter: { chunks: Array<{ content?: string }>; error: unknown } };

/** A fake AiService whose stream / completion replays a script and records its calls. */
function service(name: string, stream: StreamScript, completion?: unknown) {
  return {
    name,
    streamChatCompletion: vi.fn((opts: unknown) => {
      events.push(`stream:${name}`);
      void opts;
      return (async function* () {
        if ('throws' in stream) {
          throw stream.throws;
        }
        if ('throwsAfter' in stream) {
          for (const c of stream.throwsAfter.chunks) {
            yield c;
          }
          throw stream.throwsAfter.error;
        }
        for (const c of stream.chunks) {
          yield c;
        }
      })();
    }),
    chatCompletion: vi.fn(async () => {
      events.push(`complete:${name}`);
      if (completion instanceof Error || (completion as { statusCode?: number })?.statusCode) {
        throw completion;
      }
      return completion;
    }),
  };
}

const rateLimitErr = () => Object.assign(new Error('429 rate limit'), { statusCode: 429 });
const serverErr = () => Object.assign(new Error('upstream 503'), { statusCode: 503 });

const result = (content: string, model: string, extra: Record<string, unknown> = {}) => ({
  content,
  model,
  inputTokens: 10,
  outputTokens: 5,
  totalTokens: 15,
  isFreeModel: true,
  usedByok: false,
  costBtc: 0,
  ...extra,
});

// ---------- world ----------

const events: string[] = [];
let keyService: { incrementPlatformUsage: Mock };

interface Link {
  provider: string;
  modelToUse: string;
  aiService: ReturnType<typeof service>;
  hasByok?: boolean;
}

function resolved(primary: Link, fallbacks: Link[] = [], extra: Record<string, unknown> = {}) {
  return {
    provider: primary.provider,
    hasByok: primary.hasByok ?? false,
    modelToUse: primary.modelToUse,
    aiService: primary.aiService,
    platformUsage: { daily_limit: 20, requests_remaining: 7 },
    keyService,
    metered: false,
    fallbacks: fallbacks.map(f => ({
      provider: f.provider,
      modelToUse: f.modelToUse,
      aiService: f.aiService,
      reason: 'rate_limit',
      hasByok: f.hasByok ?? false,
      toolEndpoint: null,
      toolKey: null,
    })),
    toolEndpoint: null,
    toolKey: null,
    ...extra,
  };
}

function request(): AuthenticatedRequest {
  return {
    user: { id: USER },
    supabase: SUPABASE,
    headers: new Headers(),
  } as unknown as AuthenticatedRequest;
}

const BASE_MESSAGES = [
  { role: 'system', content: 'SYSTEM' },
  { role: 'user', content: 'earlier <attached_image name="old.png" ref="u/old.png"/>' },
  { role: 'assistant', content: 'earlier answer' },
  { role: 'user', content: 'Hello cat' },
];

beforeEach(() => {
  vi.clearAllMocks();
  // The meter's idempotency ref is a fresh UUID per request; fix it.
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000');
  events.length = 0;
  keyService = {
    incrementPlatformUsage: vi.fn(async (...a: unknown[]) => {
      events.push(`incrementPlatformUsage:${JSON.stringify(a)}`);
    }),
  };
  (getUserActorId as Mock).mockResolvedValue('actor-1');
  (storeChatImages as Mock).mockResolvedValue([]);
  (getGroqTpmLimit as Mock).mockReturnValue(8000);
  (isGroqDailyPoolSpent as Mock).mockReturnValue(false);
  (promptFitsGroqOnDemand as Mock).mockReturnValue(true);
  (prepareCatChat as Mock).mockImplementation(async () => ({
    conversationId: CONV,
    messages: BASE_MESSAGES,
    grounding: { evidence: ['E1'], subjects: ['S1'] },
    budget: null,
  }));
  (maybeEnrichWithSearchResults as Mock).mockImplementation(async (...args: unknown[]) => {
    events.push('enrich');
    return [...(args[2] as unknown[]), { role: 'system', content: 'TOOLS RAN' }];
  });
  (enforceGrounding as Mock).mockResolvedValue({ ok: true, violations: [], corrected: null });
  (runExecActions as Mock).mockResolvedValue([]);
  (saveMessages as Mock).mockImplementation(async (...a: unknown[]) => {
    events.push(`save:${(a[3] as Array<{ role: string }>).map(m => m.role).join('+')}`);
  });
  (meterCreditUsage as Mock).mockImplementation(async () => {
    events.push('meter');
  });
  (markLinkDown as Mock).mockImplementation((p: string, m: string) => {
    events.push(`markLinkDown:${p}/${m}`);
  });
  (recordOpenRouterRateLimit as Mock).mockImplementation(() => {
    events.push('recordOpenRouterRateLimit');
  });
  (alertCatChatFailure as Mock).mockImplementation(async (a: unknown) => {
    events.push(`alert:${JSON.stringify(a)}`);
  });
});

async function run(body: Partial<CatChatBody>) {
  const res = await orchestrateCatChat(
    request(),
    { message: 'Hello cat', ...body } as CatChatBody,
    RL
  );
  return res;
}

/** Read an SSE body into its frames: `{event?, data}` with data JSON-parsed. */
async function frames(res: Response) {
  const text = await res.text();
  const out: Array<Record<string, unknown>> = [];
  let pendingEvent: string | undefined;
  for (const block of text.split('\n')) {
    if (block.startsWith('event: ')) {
      pendingEvent = block.slice(7);
    } else if (block.startsWith('data: ')) {
      const data = JSON.parse(block.slice(6));
      out.push(pendingEvent ? { event: pendingEvent, data } : data);
      pendingEvent = undefined;
    }
  }
  return out;
}

/** Everything observable besides the response: calls in order + key arguments. */
function sideEffects() {
  return {
    events: [...events],
    saved: (saveMessages as Mock).mock.calls.map(c => c[3]),
    memories: (extractAndStoreMemories as Mock).mock.calls.map(c => ({
      message: c[3],
      reply: c[4],
      service: (c[5] as { name: string }).name,
      model: c[6],
    })),
    economic: (extractAndStoreEconomicProfile as Mock).mock.calls.map(c => ({
      reply: c[3],
      service: (c[4] as { name: string }).name,
      model: c[5],
    })),
    meter: (meterCreditUsage as Mock).mock.calls.map(c => c[2]),
    warns: (logger.warn as Mock).mock.calls.map(c => [c[0], c[1]]),
    served: (logger.info as Mock).mock.calls
      .filter(c => c[0] === 'Cat chat: model call served')
      .map(c => c[1]),
  };
}

// ==================== shared front half ====================

describe('before any model is called', () => {
  it('returns the resolver Response untouched (e.g. a quota refusal)', async () => {
    const refusal = new Response('{"no":1}', { status: 402 });
    (resolveProvider as Mock).mockResolvedValue(refusal);
    const res = await run({ stream: true });
    expect(res).toBe(refusal);
    expect(prepareCatChat).not.toHaveBeenCalled();
    expect(storeChatImages).not.toHaveBeenCalled();
  });

  it('asks the resolver with the requested model and whether photos are attached', async () => {
    const a = service('A', { chunks: [] }, result('ok', 'm-a'));
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'openrouter', modelToUse: 'm-a', aiService: a })
    );
    await run({
      stream: false,
      model: 'x/y',
      images: [{ name: 'p.png', dataUrl: 'data:image/png;base64,AAAA' }],
    });
    expect((resolveProvider as Mock).mock.calls[0].slice(1)).toEqual([
      USER,
      expect.any(Headers),
      { requestedModel: 'x/y', message: 'Hello cat', hasImages: true },
    ]);
  });

  it('budgets the prompt to the smallest platform-Groq cap in the chain', async () => {
    (getGroqTpmLimit as Mock).mockImplementation((m: string) => (m === 'g-small' ? 6000 : 8000));
    const a = service('A', { chunks: [] }, result('hi', 'g-big'));
    const b = service('B', { chunks: [] }, result('hi', 'g-small'));
    const c = service('C', { chunks: [] }, result('hi', 'byok-groq'));
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'groq', modelToUse: 'g-big', aiService: a }, [
        { provider: 'groq', modelToUse: 'g-small', aiService: b },
        { provider: 'groq', modelToUse: 'byok-groq', aiService: c, hasByok: true },
      ])
    );
    await run({
      stream: false,
      preferredCurrency: 'CHF',
      locale: 'de-CH',
      lastVisitedPath: '/a',
      currentPath: '/b',
      currentEntity: { type: 'product', ref: 'p1' },
      pageExcerpt: 'page',
      conversationId: CONV,
    });
    expect((prepareCatChat as Mock).mock.calls[0]).toMatchInlineSnapshot(`
      [
        {
          "_kind": "session",
        },
        "11111111-1111-4111-8111-111111111111",
        {
          "actionsVia": "prose",
          "currentEntity": {
            "ref": "p1",
            "type": "product",
          },
          "currentPath": "/b",
          "lastVisitedPath": "/a",
          "locale": "de-CH",
          "message": "Hello cat",
          "pageExcerpt": "page",
          "preferredCurrency": "CHF",
          "requestedConversationId": "99999999-9999-4999-8999-999999999999",
          "tokenBudget": 4826,
        },
      ]
    `);
  });

  it('gives a chain without platform Groq no budget', async () => {
    const a = service('A', { chunks: [] }, result('hi', 'm-a'));
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'openrouter', modelToUse: 'm-a', aiService: a })
    );
    await run({ stream: false });
    expect((prepareCatChat as Mock).mock.calls[0][2].tokenBudget).toBeUndefined();
  });

  it('logs when fitting the budget cost something', async () => {
    (prepareCatChat as Mock).mockResolvedValueOnce({
      conversationId: CONV,
      messages: BASE_MESSAGES,
      grounding: { evidence: [], subjects: [] },
      budget: {
        fits: true,
        historyDropped: 2,
        contextTruncated: false,
        contextDropped: false,
        fewShotDropped: false,
        sectionsDropped: [],
      },
    });
    const a = service('A', { chunks: [] }, result('hi', 'm-a'));
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'openrouter', modelToUse: 'm-a', aiService: a })
    );
    await run({ stream: false });
    expect(
      (logger.info as Mock).mock.calls.filter(
        c => c[0] === 'Cat chat: prompt fitted to the free-tier budget'
      )
    ).toHaveLength(1);
  });
});

// ==================== streaming ====================

describe('streaming', () => {
  it('happy path: frames, persistence, memories, platform usage', async () => {
    const a = service('A', {
      chunks: [
        { content: 'Hello' },
        { content: ' world' },
        { usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 }, done: true },
      ],
    });
    (maybeEnrichWithSearchResults as Mock).mockImplementationOnce(async (...args: unknown[]) => {
      events.push('enrich');
      const onTool = args[6] as (e: unknown) => void;
      const onPrefill = args[7] as (p: unknown) => void;
      const opts = args[8] as { onWebEvidence: (e: string[]) => void };
      onTool({ id: 't1', name: 'web_search', status: 'running' });
      onTool({ id: 't1', name: 'web_search', status: 'completed', resultCount: 0 });
      onPrefill({ entityType: 'product', fields: { title: 'X' } });
      opts.onWebEvidence(['[F1] page text']);
      return args[2];
    });
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'groq', modelToUse: 'llama-x', aiService: a })
    );
    const res = await run({ stream: true });
    expect(res.status).toBe(200);
    expect(Object.fromEntries(res.headers.entries())).toMatchInlineSnapshot(`
      {
        "cache-control": "no-cache, no-transform",
        "connection": "keep-alive",
        "content-type": "text/event-stream",
        "x-accel-buffering": "no",
        "x-ratelimit-limit": "30",
        "x-ratelimit-remaining": "29",
        "x-ratelimit-reset": "1900000000",
      }
    `);
    expect(await frames(res)).toMatchInlineSnapshot(`
      [
        {
          "model": "llama-x",
          "provider": "groq",
        },
        {
          "tool_call": {
            "id": "t1",
            "name": "web_search",
            "status": "running",
          },
        },
        {
          "tool_call": {
            "id": "t1",
            "name": "web_search",
            "resultCount": 0,
            "status": "completed",
          },
        },
        {
          "prefill_proposal": {
            "entityType": "product",
            "fields": {
              "title": "X",
            },
            "photo": {
              "field": "thumbnail_url",
              "ref": "u/old.png",
            },
          },
        },
        {
          "content": "Hello",
        },
        {
          "content": " world",
        },
        {
          "done": true,
          "grounding": {
            "ok": true,
            "unsupported": [],
          },
          "model": "llama-x",
          "provider": "groq",
          "suggestUpgrade": false,
          "usage": {
            "inputTokens": 3,
            "outputTokens": 4,
            "totalTokens": 7,
          },
        },
      ]
    `);
    expect(sideEffects()).toMatchInlineSnapshot(`
      {
        "economic": [
          {
            "model": "llama-x",
            "reply": "Hello world",
            "service": "A",
          },
        ],
        "events": [
          "enrich",
          "stream:A",
          "save:user+assistant",
          "incrementPlatformUsage:["11111111-1111-4111-8111-111111111111",1,7]",
        ],
        "memories": [
          {
            "message": "Hello cat",
            "model": "llama-x",
            "reply": "Hello world",
            "service": "A",
          },
        ],
        "meter": [],
        "saved": [
          [
            {
              "content": "Hello cat",
              "role": "user",
            },
            {
              "content": "Hello world",
              "model_used": "llama-x",
              "provider": "groq",
              "role": "assistant",
              "token_count": 7,
              "tool_calls": [
                {
                  "id": "t1",
                  "name": "web_search",
                  "status": "running",
                },
                {
                  "id": "t1",
                  "name": "web_search",
                  "resultCount": 0,
                  "status": "completed",
                },
              ],
            },
          ],
        ],
        "served": [
          {
            "link": "groq/llama-x",
          },
        ],
        "warns": [],
      }
    `);
    expect((maybeEnrichWithSearchResults as Mock).mock.calls[0][8]).toMatchInlineSnapshot(`
      {
        "actorId": "actor-1",
        "onWebEvidence": [Function],
        "toolEndpoint": null,
        "toolFallbacks": [],
        "toolKey": null,
      }
    `);
    expect((enforceGrounding as Mock).mock.calls[0][0]).toMatchObject({
      content: 'Hello world',
      grounding: { evidence: ['E1', '[F1] page text'], subjects: ['S1'] },
      model: 'llama-x',
      userId: USER,
      conversationId: CONV,
    });
  });

  it('a photo is stored, tagged in the saved message, and put on drafted proposals', async () => {
    (storeChatImages as Mock).mockResolvedValue(['u/new.png']);
    const a = service('A', { chunks: [{ content: 'ok', done: true }] });
    (maybeEnrichWithSearchResults as Mock).mockImplementationOnce(async (...args: unknown[]) => {
      (args[7] as (p: unknown) => void)({ entityType: 'product', fields: {} });
      return args[2];
    });
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'groq', modelToUse: 'llama-x', aiService: a })
    );
    const res = await run({
      stream: true,
      message: 'Sell this <attached_image name="p.png"/>',
      images: [{ name: 'p.png', dataUrl: 'data:image/png;base64,AAAA' }],
    });
    expect(await frames(res)).toMatchInlineSnapshot(`
      [
        {
          "model": "llama-x",
          "provider": "groq",
        },
        {
          "prefill_proposal": {
            "entityType": "product",
            "fields": {},
            "photo": {
              "field": "thumbnail_url",
              "ref": "u/new.png",
            },
          },
        },
        {
          "content": "ok",
        },
        {
          "done": true,
          "grounding": {
            "ok": true,
            "unsupported": [],
          },
          "model": "llama-x",
          "provider": "groq",
          "suggestUpgrade": false,
        },
      ]
    `);
    expect((saveMessages as Mock).mock.calls[0][3][0]).toMatchInlineSnapshot(`
      {
        "content": "Sell this <attached_image name="p.png" ref="u/new.png"/>",
        "role": "user",
      }
    `);
    const sent = (
      a.streamChatCompletion.mock.calls[0][0] as { messages: Array<{ content: unknown }> }
    ).messages;
    expect(sent[sent.length - 2]).toMatchInlineSnapshot(`
      {
        "content": "earlier answer",
        "role": "assistant",
      }
    `);
  });

  it('with no photo this turn, a draft carries the latest one from the thread', async () => {
    const a = service('A', { chunks: [{ content: 'ok', done: true }] });
    (maybeEnrichWithSearchResults as Mock).mockImplementationOnce(async (...args: unknown[]) => {
      (args[7] as (p: unknown) => void)({ entityType: 'product', fields: {} });
      return args[2];
    });
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'groq', modelToUse: 'llama-x', aiService: a })
    );
    const res = await run({ stream: true });
    expect((await frames(res)).find(f => 'prefill_proposal' in f)).toMatchInlineSnapshot(`
      {
        "prefill_proposal": {
          "entityType": "product",
          "fields": {},
          "photo": {
            "field": "thumbnail_url",
            "ref": "u/old.png",
          },
        },
      }
    `);
  });

  it('grounding repair replaces what is saved and parsed, and is reported in done', async () => {
    (enforceGrounding as Mock).mockResolvedValue({
      ok: false,
      violations: [{ text: '42 BTC' }],
      corrected: 'Fixed answer\n```action\n{"type":"navigate","url":"/x"}\n```',
    });
    const a = service('A', { chunks: [{ content: 'It costs 42 BTC' }, { done: true }] });
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'groq', modelToUse: 'llama-x', aiService: a })
    );
    const res = await run({ stream: true });
    expect((await frames(res)).at(-1)).toMatchInlineSnapshot(`
      {
        "correctedContent": "Fixed answer
      \`\`\`action
      {"type":"navigate","url":"/x"}
      \`\`\`",
        "done": true,
        "grounding": {
          "ok": false,
          "unsupported": [
            "42 BTC",
          ],
        },
        "model": "llama-x",
        "provider": "groq",
        "suggestUpgrade": false,
      }
    `);
    expect((runExecActions as Mock).mock.calls[0][3]).toMatchInlineSnapshot(`[]`);
    expect(sideEffects().saved).toMatchInlineSnapshot(`
      [
        [
          {
            "content": "Hello cat",
            "role": "user",
          },
          {
            "content": "Fixed answer
      \`\`\`action
      {"type":"navigate","url":"/x"}
      \`\`\`",
            "model_used": "llama-x",
            "provider": "groq",
            "role": "assistant",
            "token_count": undefined,
            "tool_calls": [],
          },
        ],
      ]
    `);
  });

  it('a stream that ends without a done chunk still finishes', async () => {
    const a = service('A', { chunks: [{ content: 'partial' }] });
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'groq', modelToUse: 'llama-x', aiService: a })
    );
    const res = await run({ stream: true });
    expect(await frames(res)).toMatchInlineSnapshot(`
      [
        {
          "model": "llama-x",
          "provider": "groq",
        },
        {
          "content": "partial",
        },
        {
          "done": true,
          "grounding": {
            "ok": true,
            "unsupported": [],
          },
          "model": "llama-x",
          "provider": "groq",
          "suggestUpgrade": false,
        },
      ]
    `);
    expect(sideEffects().served).toMatchInlineSnapshot(`[]`);
  });

  it('primary rate-limited before streaming: falls back, marks the platform link down', async () => {
    const a = service('A', { throws: rateLimitErr() });
    const b = service('B', {
      chunks: [{ content: 'from B' }, { usage: { totalTokens: 9 }, done: true }],
    });
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'openrouter', modelToUse: 'or-a', aiService: a }, [
        { provider: 'groq', modelToUse: 'g-b', aiService: b },
      ])
    );
    const res = await run({ stream: true });
    expect(await frames(res)).toMatchInlineSnapshot(`
      [
        {
          "model": "or-a",
          "provider": "openrouter",
        },
        {
          "fallback": {
            "from": "openrouter",
            "model": "g-b",
            "reason": "rate_limit",
            "to": "groq",
          },
        },
        {
          "model": "g-b",
          "provider": "groq",
        },
        {
          "content": "from B",
        },
        {
          "done": true,
          "grounding": {
            "ok": true,
            "unsupported": [],
          },
          "model": "g-b",
          "provider": "groq",
          "suggestUpgrade": false,
          "usage": {
            "totalTokens": 9,
          },
        },
      ]
    `);
    expect(sideEffects()).toMatchInlineSnapshot(`
      {
        "economic": [
          {
            "model": "g-b",
            "reply": "from B",
            "service": "B",
          },
        ],
        "events": [
          "enrich",
          "stream:A",
          "recordOpenRouterRateLimit",
          "markLinkDown:openrouter/or-a",
          "stream:B",
          "save:user+assistant",
          "incrementPlatformUsage:["11111111-1111-4111-8111-111111111111",1,9]",
        ],
        "memories": [
          {
            "message": "Hello cat",
            "model": "g-b",
            "reply": "from B",
            "service": "B",
          },
        ],
        "meter": [],
        "saved": [
          [
            {
              "content": "Hello cat",
              "role": "user",
            },
            {
              "content": "from B",
              "model_used": "g-b",
              "provider": "groq",
              "role": "assistant",
              "token_count": 9,
              "tool_calls": [],
            },
          ],
        ],
        "served": [
          {
            "link": "groq/g-b",
          },
        ],
        "warns": [
          [
            "Cat chat: provider failed, trying next fallback",
            {
              "attempt": 1,
              "err": [Error: 429 rate limit],
              "from": {
                "model": "or-a",
                "provider": "openrouter",
              },
              "reason": "rate_limit",
              "to": {
                "model": "g-b",
                "provider": "groq",
              },
            },
          ],
        ],
      }
    `);
  });

  it('a BYOK link that fails is never marked down', async () => {
    const a = service('A', { throws: serverErr() });
    const b = service('B', { chunks: [{ content: 'from B', done: true }] });
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'openrouter', modelToUse: 'or-a', aiService: a, hasByok: true }, [
        { provider: 'groq', modelToUse: 'g-b', aiService: b },
      ])
    );
    await (await run({ stream: true })).text();
    expect(markLinkDown).not.toHaveBeenCalled();
  });

  it('pre-flight skips a platform-Groq primary whose prompt cannot fit, without marking it down', async () => {
    (promptFitsGroqOnDemand as Mock).mockImplementation(
      (_m: unknown, model: string) => model !== 'g-a'
    );
    const a = service('A', { chunks: [{ content: 'never' }] });
    const b = service('B', { chunks: [{ content: 'from B', done: true }] });
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'groq', modelToUse: 'g-a', aiService: a }, [
        { provider: 'openrouter', modelToUse: 'or-b', aiService: b },
      ])
    );
    const res = await run({ stream: true });
    expect(await frames(res)).toMatchInlineSnapshot(`
      [
        {
          "model": "g-a",
          "provider": "groq",
        },
        {
          "fallback": {
            "from": "groq",
            "model": "or-b",
            "reason": "provider_error",
            "to": "openrouter",
          },
        },
        {
          "model": "or-b",
          "provider": "openrouter",
        },
        {
          "content": "from B",
        },
        {
          "done": true,
          "grounding": {
            "ok": true,
            "unsupported": [],
          },
          "model": "or-b",
          "provider": "openrouter",
          "suggestUpgrade": false,
        },
      ]
    `);
    expect(sideEffects().events).toMatchInlineSnapshot(`
      [
        "enrich",
        "stream:B",
        "save:user+assistant",
      ]
    `);
  });

  it('a spent Groq day is skipped like an overflow', async () => {
    (isGroqDailyPoolSpent as Mock).mockImplementation((m: string) => m === 'g-a');
    const a = service('A', { chunks: [{ content: 'never' }] });
    const b = service('B', { chunks: [{ content: 'from B', done: true }] });
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'groq', modelToUse: 'g-a', aiService: a }, [
        { provider: 'openrouter', modelToUse: 'or-b', aiService: b },
      ])
    );
    await (await run({ stream: true })).text();
    expect(a.streamChatCompletion).not.toHaveBeenCalled();
  });

  it('with no fallbacks, an overflowing platform-Groq primary is still attempted', async () => {
    (promptFitsGroqOnDemand as Mock).mockReturnValue(false);
    const a = service('A', { chunks: [{ content: 'tried', done: true }] });
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'groq', modelToUse: 'g-a', aiService: a })
    );
    await (await run({ stream: true })).text();
    expect(a.streamChatCompletion).toHaveBeenCalled();
  });

  it('a middle link that cannot fit is skipped; the LAST link is always tried', async () => {
    (promptFitsGroqOnDemand as Mock).mockReturnValue(false);
    const a = service('A', { throws: serverErr() });
    const b = service('B', { chunks: [{ content: 'never' }] });
    const c = service('C', { chunks: [{ content: 'last', done: true }] });
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'openrouter', modelToUse: 'or-a', aiService: a }, [
        { provider: 'groq', modelToUse: 'g-b', aiService: b },
        { provider: 'groq', modelToUse: 'g-c', aiService: c },
      ])
    );
    const res = await run({ stream: true });
    expect(await frames(res)).toMatchInlineSnapshot(`
      [
        {
          "model": "or-a",
          "provider": "openrouter",
        },
        {
          "fallback": {
            "from": "openrouter",
            "model": "g-c",
            "reason": "provider_error",
            "to": "groq",
          },
        },
        {
          "model": "g-c",
          "provider": "groq",
        },
        {
          "content": "last",
        },
        {
          "done": true,
          "grounding": {
            "ok": true,
            "unsupported": [],
          },
          "model": "g-c",
          "provider": "groq",
          "suggestUpgrade": false,
        },
      ]
    `);
    expect(sideEffects().events).toMatchInlineSnapshot(`
      [
        "enrich",
        "stream:A",
        "recordOpenRouterRateLimit",
        "markLinkDown:openrouter/or-a",
        "stream:C",
        "save:user+assistant",
      ]
    `);
  });

  it('every link empty: the chain ends with the honest sentence, not an error', async () => {
    const a = service('A', { chunks: [{ done: true }] });
    const b = service('B', { chunks: [] });
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'groq', modelToUse: 'g-a', aiService: a }, [
        { provider: 'openrouter', modelToUse: 'or-b', aiService: b },
      ])
    );
    const res = await run({ stream: true });
    expect(await frames(res)).toMatchInlineSnapshot(`
      [
        {
          "model": "g-a",
          "provider": "groq",
        },
        {
          "fallback": {
            "from": "groq",
            "model": "or-b",
            "reason": "provider_error",
            "to": "openrouter",
          },
        },
        {
          "model": "or-b",
          "provider": "openrouter",
        },
        {
          "content": "I couldn't put together a reply to that. Could you rephrase or add a bit more detail?",
        },
        {
          "done": true,
          "grounding": {
            "ok": true,
            "unsupported": [],
          },
          "model": "or-b",
          "provider": "openrouter",
          "suggestUpgrade": false,
        },
      ]
    `);
    expect(sideEffects()).toMatchInlineSnapshot(`
      {
        "economic": [
          {
            "model": "or-b",
            "reply": "I couldn't put together a reply to that. Could you rephrase or add a bit more detail?",
            "service": "B",
          },
        ],
        "events": [
          "enrich",
          "stream:A",
          "markLinkDown:groq/g-a",
          "stream:B",
          "recordOpenRouterRateLimit",
          "markLinkDown:openrouter/or-b",
          "save:user+assistant",
        ],
        "memories": [
          {
            "message": "Hello cat",
            "model": "or-b",
            "reply": "I couldn't put together a reply to that. Could you rephrase or add a bit more detail?",
            "service": "B",
          },
        ],
        "meter": [],
        "saved": [
          [
            {
              "content": "Hello cat",
              "role": "user",
            },
            {
              "content": "I couldn't put together a reply to that. Could you rephrase or add a bit more detail?",
              "model_used": "or-b",
              "provider": "openrouter",
              "role": "assistant",
              "token_count": undefined,
              "tool_calls": [],
            },
          ],
        ],
        "served": [],
        "warns": [
          [
            "Cat chat: provider failed, trying next fallback",
            {
              "attempt": 1,
              "err": [EmptyCompletion: empty completion from groq/g-a],
              "from": {
                "model": "g-a",
                "provider": "groq",
              },
              "reason": "provider_error",
              "to": {
                "model": "or-b",
                "provider": "openrouter",
              },
            },
          ],
        ],
      }
    `);
  });

  it('a failure after content streamed is not retried: error event, failed turn saved, alert', async () => {
    const a = service('A', { throwsAfter: { chunks: [{ content: 'half' }], error: serverErr() } });
    const b = service('B', { chunks: [{ content: 'never', done: true }] });
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'groq', modelToUse: 'g-a', aiService: a }, [
        { provider: 'openrouter', modelToUse: 'or-b', aiService: b },
      ])
    );
    const res = await run({ stream: true });
    expect(await frames(res)).toMatchInlineSnapshot(`
      [
        {
          "model": "g-a",
          "provider": "groq",
        },
        {
          "content": "half",
        },
        {
          "data": {
            "code": "STREAM_ERROR",
            "error": "Cat couldn’t generate a response. Try again, or add your own key in Settings → AI.",
          },
          "event": "error",
        },
      ]
    `);
    expect(sideEffects()).toMatchInlineSnapshot(`
      {
        "economic": [],
        "events": [
          "enrich",
          "stream:A",
          "markLinkDown:groq/g-a",
          "save:user+assistant",
          "alert:{"userId":"11111111-1111-4111-8111-111111111111","code":"STREAM_ERROR","provider":"groq","model":"g-a"}",
        ],
        "memories": [],
        "meter": [],
        "saved": [
          [
            {
              "content": "Hello cat",
              "role": "user",
            },
            {
              "content": "half

      [This reply was cut off by a connection error.]",
              "model_used": "g-a",
              "provider": "groq",
              "role": "assistant",
            },
          ],
        ],
        "served": [],
        "warns": [],
      }
    `);
  });

  it.each([
    ['rate limit, platform', rateLimitErr, false, []],
    ['rate limit, BYOK', rateLimitErr, true, []],
    ['whole chain failed, platform', serverErr, false, ['fb']],
    ['whole chain failed, BYOK', serverErr, true, ['fb']],
    ['single link failed', serverErr, false, []],
  ])('error copy: %s', async (_label, makeErr, byok, fb) => {
    const a = service('A', { throws: makeErr() });
    const b = service('B', { throws: makeErr() });
    (resolveProvider as Mock).mockResolvedValue(
      resolved(
        { provider: 'groq', modelToUse: 'g-a', aiService: a, hasByok: byok as boolean },
        (fb as string[]).map(() => ({
          provider: 'openrouter',
          modelToUse: 'or-b',
          aiService: b,
          hasByok: byok as boolean,
        }))
      )
    );
    const res = await run({ stream: true });
    const all = await frames(res);
    expect(all.at(-1)).toMatchSnapshot();
    expect(sideEffects().events).toMatchSnapshot();
  });

  it('an openrouter rate limit is recorded for the capacity meter', async () => {
    const a = service('A', { throws: rateLimitErr() });
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'openrouter', modelToUse: 'or-a', aiService: a })
    );
    await (await run({ stream: true })).text();
    expect(recordOpenRouterRateLimit).toHaveBeenCalledWith('429 rate limit');
  });

  it('metered: debits when the metered primary served, not when a fallback did', async () => {
    const a = service('A', {
      chunks: [
        { content: 'paid' },
        { usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3, costBtc: 0.0001 }, done: true },
      ],
    });
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'openrouter', modelToUse: 'frontier', aiService: a }, [], {
        metered: true,
      })
    );
    await (await run({ stream: true })).text();
    expect(sideEffects().meter).toMatchInlineSnapshot(`
      [
        {
          "conversationId": "99999999-9999-4999-8999-999999999999",
          "inputTokens": 1,
          "model": "frontier",
          "outputTokens": 2,
          "rawCostBtc": 0.0001,
          "ref": "cat_chat_00000000-0000-4000-8000-000000000000",
        },
      ]
    `);
    expect(keyService.incrementPlatformUsage).not.toHaveBeenCalled();

    vi.clearAllMocks();
    const a2 = service('A2', { throws: rateLimitErr() });
    const b2 = service('B2', {
      chunks: [{ content: 'free' }, { usage: { totalTokens: 3 }, done: true }],
    });
    (resolveProvider as Mock).mockResolvedValue(
      resolved(
        { provider: 'openrouter', modelToUse: 'frontier', aiService: a2 },
        [{ provider: 'groq', modelToUse: 'g', aiService: b2 }],
        { metered: true }
      )
    );
    await (await run({ stream: true })).text();
    expect(meterCreditUsage).not.toHaveBeenCalled();
    expect(keyService.incrementPlatformUsage).toHaveBeenCalledWith(USER, 1, 3);
  });

  it('BYOK usage is not counted against the platform', async () => {
    const a = service('A', {
      chunks: [{ content: 'x' }, { usage: { totalTokens: 3 }, done: true }],
    });
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'groq', modelToUse: 'g', aiService: a, hasByok: true })
    );
    await (await run({ stream: true })).text();
    expect(keyService.incrementPlatformUsage).not.toHaveBeenCalled();
  });

  it('without a conversation, nothing is saved or learned', async () => {
    (prepareCatChat as Mock).mockResolvedValueOnce({
      conversationId: null,
      messages: BASE_MESSAGES,
      grounding: { evidence: [], subjects: [] },
      budget: null,
    });
    const a = service('A', { chunks: [{ content: 'x', done: true }] });
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'groq', modelToUse: 'g', aiService: a })
    );
    await (await run({ stream: true })).text();
    expect(saveMessages).not.toHaveBeenCalled();
    expect(extractAndStoreMemories).not.toHaveBeenCalled();
  });

  it('suggests an upgrade when the message wants tools and the model is not agentic', async () => {
    const a = service('A', { chunks: [{ content: 'x', done: true }] });
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'groq', modelToUse: 'llama-x', aiService: a })
    );
    const res = await run({
      stream: true,
      message: 'Create a project for my bakery and find investors',
    });
    expect(
      ((await frames(res)).at(-1) as { suggestUpgrade: boolean }).suggestUpgrade
    ).toMatchInlineSnapshot(`true`);
  });
});

// ==================== non-streaming ====================

describe('non-streaming', () => {
  it('happy path: JSON body, persistence, memories, platform usage', async () => {
    const a = service('A', { chunks: [] }, result('Hello there', 'llama-x'));
    (maybeEnrichWithSearchResults as Mock).mockImplementationOnce(async (...args: unknown[]) => {
      (args[6] as (e: unknown) => void)({ id: 't1', name: 'web_search', status: 'completed' });
      (args[7] as (p: unknown) => void)({ entityType: 'service', fields: {} });
      return args[2];
    });
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'groq', modelToUse: 'llama-x', aiService: a })
    );
    const res = await run({ stream: false });
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('29');
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toMatchInlineSnapshot(`
      {
        "message": "Hello there",
        "modelUsed": "llama-x",
        "prefillProposals": [
          {
            "entityType": "service",
            "fields": {},
          },
        ],
        "provider": "groq",
        "suggestUpgrade": false,
        "toolCalls": [
          {
            "id": "t1",
            "name": "web_search",
            "status": "completed",
          },
        ],
        "usage": {
          "apiCostBtc": 0,
          "inputTokens": 10,
          "isFreeModel": true,
          "outputTokens": 5,
          "totalTokens": 15,
          "usedByok": false,
        },
        "userStatus": {
          "freeMessagesPerDay": 20,
          "freeMessagesRemaining": 7,
          "hasByok": false,
        },
      }
    `);
    expect(sideEffects()).toMatchInlineSnapshot(`
      {
        "economic": [
          {
            "model": "llama-x",
            "reply": "Hello there",
            "service": "A",
          },
        ],
        "events": [
          "complete:A",
          "incrementPlatformUsage:["11111111-1111-4111-8111-111111111111",1,15]",
          "save:user+assistant",
        ],
        "memories": [
          {
            "message": "Hello cat",
            "model": "llama-x",
            "reply": "Hello there",
            "service": "A",
          },
        ],
        "meter": [],
        "saved": [
          [
            {
              "content": "Hello cat",
              "role": "user",
            },
            {
              "content": "Hello there",
              "model_used": "llama-x",
              "provider": "groq",
              "role": "assistant",
              "token_count": 15,
              "tool_calls": [
                {
                  "id": "t1",
                  "name": "web_search",
                  "status": "completed",
                },
              ],
            },
          ],
        ],
        "served": [
          {
            "link": "groq/llama-x",
          },
        ],
        "warns": [],
      }
    `);
    expect(enforceGrounding).not.toHaveBeenCalled();
    expect((maybeEnrichWithSearchResults as Mock).mock.calls[0][8]).toMatchInlineSnapshot(`
      {
        "actorId": "actor-1",
        "toolEndpoint": null,
        "toolFallbacks": [],
        "toolKey": null,
      }
    `);
  });

  it('an empty first answer falls through to the next link', async () => {
    const a = service('A', { chunks: [] }, result('   ', 'g-a'));
    const b = service('B', { chunks: [] }, result('from B', 'or-b'));
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'groq', modelToUse: 'g-a', aiService: a }, [
        { provider: 'openrouter', modelToUse: 'or-b', aiService: b },
      ])
    );
    const res = await run({ stream: false });
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect({
      provider: body.data.provider,
      modelUsed: body.data.modelUsed,
      fallback: body.data.fallback,
      message: body.data.message,
    }).toMatchInlineSnapshot(`
      {
        "fallback": {
          "from": "groq",
          "model": "or-b",
          "reason": "rate_limit",
          "to": "openrouter",
        },
        "message": "from B",
        "modelUsed": "or-b",
        "provider": "openrouter",
      }
    `);
    expect(sideEffects()).toMatchInlineSnapshot(`
      {
        "economic": [
          {
            "model": "or-b",
            "reply": "from B",
            "service": "B",
          },
        ],
        "events": [
          "enrich",
          "complete:A",
          "markLinkDown:groq/g-a",
          "complete:B",
          "incrementPlatformUsage:["11111111-1111-4111-8111-111111111111",1,15]",
          "save:user+assistant",
        ],
        "memories": [
          {
            "message": "Hello cat",
            "model": "or-b",
            "reply": "from B",
            "service": "B",
          },
        ],
        "meter": [],
        "saved": [
          [
            {
              "content": "Hello cat",
              "role": "user",
            },
            {
              "content": "from B",
              "model_used": "or-b",
              "provider": "openrouter",
              "role": "assistant",
              "token_count": 15,
              "tool_calls": [],
            },
          ],
        ],
        "served": [
          {
            "link": "openrouter/or-b",
          },
        ],
        "warns": [
          [
            "Cat chat (non-streaming): provider failed, trying next fallback",
            {
              "attempt": 1,
              "err": [EmptyCompletion: empty completion from groq/g-a],
              "from": "groq",
              "model": "or-b",
              "reason": "provider_error",
              "to": "openrouter",
            },
          ],
        ],
      }
    `);
  });

  it('pre-flight skip and a skipped middle link, then the last link answers', async () => {
    (promptFitsGroqOnDemand as Mock).mockReturnValue(false);
    const a = service('A', { chunks: [] }, result('never', 'g-a'));
    const b = service('B', { chunks: [] }, result('never', 'g-b'));
    const c = service('C', { chunks: [] }, result('last', 'g-c'));
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'groq', modelToUse: 'g-a', aiService: a }, [
        { provider: 'groq', modelToUse: 'g-b', aiService: b },
        { provider: 'groq', modelToUse: 'g-c', aiService: c },
      ])
    );
    const res = await run({ stream: false });
    expect(((await res.json()) as { data: { message: string } }).data.message).toBe('last');
    expect(sideEffects().events).toMatchInlineSnapshot(`
      [
        "enrich",
        "complete:C",
        "incrementPlatformUsage:["11111111-1111-4111-8111-111111111111",1,15]",
        "save:user+assistant",
      ]
    `);
  });

  it('every link failing throws the last error and marks the last platform link down', async () => {
    const a = service('A', { chunks: [] }, rateLimitErr());
    const b = service('B', { chunks: [] }, serverErr());
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'openrouter', modelToUse: 'or-a', aiService: a }, [
        { provider: 'groq', modelToUse: 'g-b', aiService: b },
      ])
    );
    await expect(run({ stream: false })).rejects.toThrow('upstream 503');
    expect(sideEffects()).toMatchInlineSnapshot(`
      {
        "economic": [],
        "events": [
          "enrich",
          "complete:A",
          "recordOpenRouterRateLimit",
          "markLinkDown:openrouter/or-a",
          "complete:B",
          "markLinkDown:groq/g-b",
        ],
        "memories": [],
        "meter": [],
        "saved": [],
        "served": [],
        "warns": [
          [
            "Cat chat (non-streaming): provider failed, trying next fallback",
            {
              "attempt": 1,
              "err": [Error: 429 rate limit],
              "from": "openrouter",
              "model": "g-b",
              "reason": "rate_limit",
              "to": "groq",
            },
          ],
        ],
      }
    `);
  });

  it('an empty answer with no fallback throws EmptyCompletion', async () => {
    const a = service('A', { chunks: [] }, result('', 'g-a'));
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'groq', modelToUse: 'g-a', aiService: a })
    );
    await expect(run({ stream: false })).rejects.toMatchObject({ name: 'EmptyCompletion' });
  });

  it('metered: debits only when the primary served', async () => {
    const a = service('A', { chunks: [] }, result('paid', 'frontier', { costBtc: 0.001 }));
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'openrouter', modelToUse: 'frontier', aiService: a }, [], {
        metered: true,
      })
    );
    await run({ stream: false });
    expect(sideEffects().meter).toMatchInlineSnapshot(`
      [
        {
          "conversationId": "99999999-9999-4999-8999-999999999999",
          "inputTokens": 10,
          "model": "frontier",
          "outputTokens": 5,
          "rawCostBtc": 0.001,
          "ref": "cat_chat_00000000-0000-4000-8000-000000000000",
        },
      ]
    `);
    expect(keyService.incrementPlatformUsage).not.toHaveBeenCalled();
  });

  it('metered but a fallback answered: counted as platform usage instead', async () => {
    const a = service('A', { chunks: [] }, rateLimitErr());
    const b = service('B', { chunks: [] }, result('free', 'g'));
    (resolveProvider as Mock).mockResolvedValue(
      resolved(
        { provider: 'openrouter', modelToUse: 'frontier', aiService: a },
        [{ provider: 'groq', modelToUse: 'g', aiService: b }],
        { metered: true }
      )
    );
    await run({ stream: false });
    expect(meterCreditUsage).not.toHaveBeenCalled();
    expect(keyService.incrementPlatformUsage).toHaveBeenCalledWith(USER, 1, 15);
  });

  it('actions in the answer are parsed out of the message and executed', async () => {
    (runExecActions as Mock).mockResolvedValue([{ ok: true }]);
    const a = service(
      'A',
      { chunks: [] },
      result(
        'Sure.\n```exec_action\n{"type":"create_entity","entityType":"product","data":{"title":"T"}}\n```',
        'g'
      )
    );
    (resolveProvider as Mock).mockResolvedValue(
      resolved({ provider: 'groq', modelToUse: 'g', aiService: a })
    );
    const res = await run({ stream: false });
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect({
      message: body.data.message,
      actions: body.data.actions,
      execResults: body.data.execResults,
    }).toMatchInlineSnapshot(`
      {
        "actions": undefined,
        "execResults": [
          {
            "ok": true,
          },
        ],
        "message": "Sure.",
      }
    `);
  });
});

/**
 * The fleet chat-review export: the token check fails closed, and the
 * transcripts leave in chatkit's shape — bounded, anonymised, no temporary chats.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHAT_REVIEW_PRODUCT,
  REVIEW_EXPORT_MAX_CONTENT,
  REVIEW_EXPORT_MAX_TURNS,
  chatReviewScope,
  exportChatTranscripts,
  reviewExportWindow,
  stepsFromToolCalls,
  toTranscript,
  verifyChatReviewToken,
} from '@/services/cat/chat-review-export';
import { TRUNCATED_REPLY_SUFFIX } from '@/services/cat/failed-turn';

function requestWithAuth(header?: string): Request {
  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === 'authorization' ? (header ?? null) : null),
    },
  } as unknown as Request;
}

describe('verifyChatReviewToken', () => {
  const original = process.env.CHAT_REVIEW_TOKEN;
  afterEach(() => {
    if (original === undefined) delete process.env.CHAT_REVIEW_TOKEN;
    else process.env.CHAT_REVIEW_TOKEN = original;
  });

  it('is unconfigured when the env is unset or empty — never "Bearer undefined"', () => {
    delete process.env.CHAT_REVIEW_TOKEN;
    expect(verifyChatReviewToken(requestWithAuth('Bearer undefined'))).toBe('unconfigured');
    process.env.CHAT_REVIEW_TOKEN = '';
    expect(verifyChatReviewToken(requestWithAuth('Bearer '))).toBe('unconfigured');
  });

  describe('with a token set', () => {
    beforeEach(() => {
      process.env.CHAT_REVIEW_TOKEN = 'a-shared-secret';
    });
    it('accepts the exact bearer', () => {
      expect(verifyChatReviewToken(requestWithAuth('Bearer a-shared-secret'))).toBe('ok');
    });
    it('rejects a missing, wrong, prefixed or longer header', () => {
      expect(verifyChatReviewToken(requestWithAuth())).toBe('unauthorized');
      expect(verifyChatReviewToken(requestWithAuth('Bearer a-shared-secre'))).toBe('unauthorized');
      expect(verifyChatReviewToken(requestWithAuth('Bearer a-shared-secret!'))).toBe(
        'unauthorized'
      );
      expect(verifyChatReviewToken(requestWithAuth('a-shared-secret'))).toBe('unauthorized');
    });
  });
});

describe('chatReviewScope', () => {
  it("is 3–6 sentences from Cat's own prompt and tool list", () => {
    const scope = chatReviewScope();
    expect(scope).toContain('OrangeCat is a permissionless platform');
    expect(scope).toContain('web_search');
    expect(scope).toContain('search_platform');
    const sentences = scope.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(Boolean);
    expect(sentences.length).toBeGreaterThanOrEqual(3);
    expect(sentences.length).toBeLessThanOrEqual(6);
  });
});

describe('reviewExportWindow', () => {
  it('defaults to the last 24 hours and caps the limit at 50', () => {
    const before = Date.now();
    const w = reviewExportWindow('https://x/api/chat/review-export?limit=500');
    expect(w.limit).toBe(50);
    expect(before - Date.parse(w.since)).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
  });
  it('takes a valid since and a smaller limit', () => {
    const w = reviewExportWindow('https://x/?since=2026-10-21T00:00:00.000Z&limit=5');
    expect(w).toEqual({ since: '2026-10-21T00:00:00.000Z', limit: 5 });
  });
  it('ignores an unparsable since', () => {
    const w = reviewExportWindow('https://x/?since=yesterday');
    expect(Number.isNaN(Date.parse(w.since))).toBe(false);
  });
});

describe('stepsFromToolCalls', () => {
  it('labels each stored call by name, status and count', () => {
    expect(
      stepsFromToolCalls([
        { id: '1', name: 'web_search', status: 'completed', resultCount: 5, results: [] },
        { id: '2', name: 'read_page', status: 'failed' },
      ])
    ).toEqual(['web_search: completed (5)', 'read_page: failed']);
    expect(stepsFromToolCalls(null)).toBeUndefined();
    expect(stepsFromToolCalls([])).toBeUndefined();
  });
});

describe('toTranscript', () => {
  const conv = { id: 'c1', updated_at: '2026-10-22T10:00:00.000Z' };
  it('orders turns, bounds them to 30 and 4000 chars, and carries steps, failed and thumbs', () => {
    const messages = Array.from({ length: 40 }, (_, i) => ({
      id: `m${i}`,
      conversation_id: 'c1',
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: i === 39 ? 'x'.repeat(5000) : `turn ${i}`,
      tool_calls:
        i === 37 ? [{ id: 't', name: 'web_search', status: 'completed', resultCount: 2 }] : null,
      created_at: new Date(Date.UTC(2026, 9, 22, 9, i)).toISOString(),
    })).reverse();
    const t = toTranscript(conv, messages, [
      { conversation_id: 'c1', message_id: 'm37', verdict: 'down', reason: 'vague', text: 'meh' },
    ]);
    expect(t.id).toBe('c1');
    expect(t.turns).toHaveLength(REVIEW_EXPORT_MAX_TURNS);
    expect(t.turns[0].id).toBe('m10');
    expect(t.turns.at(-1)?.content).toHaveLength(REVIEW_EXPORT_MAX_CONTENT);
    expect(t.at).toBe(new Date(Date.UTC(2026, 9, 22, 9, 39)).toISOString());
    expect(t.turns.find(x => x.id === 'm37')?.steps).toEqual(['web_search: completed (2)']);
    expect(t.feedback).toEqual([
      { messageId: 'm37', verdict: 'down', reason: 'vague', text: 'meh' },
    ]);
    expect(t.turns.every(x => !('failed' in x))).toBe(true);
  });
  it('flags a truncated or failed answer', () => {
    const t = toTranscript(
      conv,
      [
        {
          id: 'u',
          conversation_id: 'c1',
          role: 'user',
          content: 'hi',
          created_at: '2026-10-22T09:00:00Z',
        },
        {
          id: 'a',
          conversation_id: 'c1',
          role: 'assistant',
          content: `half an answer${TRUNCATED_REPLY_SUFFIX}`,
          created_at: '2026-10-22T09:01:00Z',
        },
      ],
      []
    );
    expect(t.turns[1].failed).toBe(true);
    expect(t.feedback).toBeUndefined();
  });
  it('carries no person-identifying field', () => {
    const t = toTranscript(
      conv,
      [
        {
          id: 'u',
          conversation_id: 'c1',
          role: 'user',
          content: 'hi',
          created_at: '2026-10-22T09:00:00Z',
        },
      ],
      []
    );
    expect(JSON.stringify(t)).not.toMatch(/user_id|actor_id|email|name/);
    expect(Object.keys(t).sort()).toEqual(['at', 'id', 'surface', 'turns']);
  });
});

describe('exportChatTranscripts', () => {
  it('asks only for non-temporary conversations in the window, newest first, and joins their rows', async () => {
    const calls: Record<string, unknown>[] = [];
    const chain = (table: string, result: unknown) => {
      const rec: Record<string, unknown> = { table };
      calls.push(rec);
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'gte', 'in', 'order', 'limit']) {
        q[m] = (...args: unknown[]) => {
          rec[m] = args;
          return q;
        };
      }
      q.then = (resolve: (v: unknown) => void) => resolve(result);
      return q;
    };
    const admin = {
      from: vi.fn((table: string) => {
        if (table === 'cat_conversations') {
          return chain(table, {
            data: [
              { id: 'c2', updated_at: '2026-10-22T08:00:00Z' },
              { id: 'c1', updated_at: '2026-10-22T07:00:00Z' },
            ],
            error: null,
          });
        }
        if (table === 'cat_messages') {
          return chain(table, {
            data: [
              {
                id: 'm1',
                conversation_id: 'c1',
                role: 'user',
                content: 'a',
                created_at: '2026-10-22T07:00:00Z',
              },
              {
                id: 'm2',
                conversation_id: 'c1',
                role: 'assistant',
                content: 'b',
                created_at: '2026-10-22T07:00:01Z',
              },
            ],
            error: null,
          });
        }
        return chain(table, { data: [], error: null });
      }),
    };
    const out = await exportChatTranscripts(admin as never, {
      since: '2026-10-21T00:00:00Z',
      limit: 10,
    });
    const convCall = calls.find(c => c.table === 'cat_conversations')!;
    expect(convCall.eq).toEqual(['ephemeral', false]);
    expect(convCall.gte).toEqual(['updated_at', '2026-10-21T00:00:00Z']);
    expect(convCall.order).toEqual(['updated_at', { ascending: false }]);
    expect(convCall.limit).toEqual([10]);
    expect(calls.find(c => c.table === 'chat_feedback')?.in).toEqual([
      'conversation_id',
      ['c2', 'c1'],
    ]);
    // c2 has no stored turns and is left out; c1 comes through whole.
    expect(out.map(t => t.id)).toEqual(['c1']);
    expect(out[0].turns.map(t => t.role)).toEqual(['user', 'assistant']);
  });
  it('names the product the fleet files under', () => {
    expect(CHAT_REVIEW_PRODUCT).toBe('orangecat');
  });
});

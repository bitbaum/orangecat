import { describe, it, expect, vi } from 'vitest';
import {
  statedMemoryLines,
  parseDistilledFacts,
  extractCompanionMemories,
  rememberCompanionFacts,
  deleteAllCompanionMemories,
  MAX_MEMORIES_PER_PAIR,
  MAX_MEMORY_CHARS,
} from '@/services/companions/memory';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/**
 * Companion memory: the rows a companion keeps about ONE person.
 *
 * Pins the two write paths (stated lines verbatim with no model call;
 * distilled facts only after self-disclosure), the pair scoping on every
 * write and delete, and the oldest-first prune within the pair. Embeddings
 * are off in the unit env, so the RPC dedupe path is not exercised here.
 */

interface Captured {
  inserted: Array<Record<string, unknown>>;
  deletes: Array<Array<[string, unknown]>>;
  counts: number;
}

function mockSupabase(opts: { count?: number } = {}) {
  const captured: Captured = { inserted: [], deletes: [], counts: opts.count ?? 0 };
  const client = {
    from: (_table: string) => {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      for (const m of ['select', 'eq', 'order', 'limit', 'in']) {
        builder[m] = chain;
      }
      builder.insert = (rows: Array<Record<string, unknown>>) => {
        captured.inserted.push(...rows);
        return Promise.resolve({ error: null });
      };
      builder.delete = () => {
        const filters: Array<[string, unknown]> = [];
        captured.deletes.push(filters);
        const d: Record<string, unknown> = {};
        d.eq = (col: string, val: unknown) => {
          filters.push([col, val]);
          return d;
        };
        d.in = (col: string, val: unknown) => {
          filters.push([col, val]);
          return Promise.resolve({ error: null });
        };
        d.then = (resolve: (v: unknown) => void) => resolve({ error: null });
        return d;
      };
      builder.then = (resolve: (v: unknown) => void) => {
        resolve({ data: [{ id: 'old-1' }], error: null, count: captured.counts });
      };
      return builder;
    },
    rpc: vi.fn(async () => ({ data: [], error: null })),
  } as unknown as AnySupabaseClient;
  return { client, captured };
}

const key = { assistantId: 'comp-1', userId: 'user-1' };

describe('statedMemoryLines', () => {
  it('keeps only lines with a log prefix, verbatim, ignoring markdown bullets', () => {
    const reply = [
      'Take your time.',
      '- Method log | sleep | worry postponement | no move | the list grew',
      '> About | prefers to be asked one question at a time',
      'Do not | cheerleading for sleep | it reads as dismissal',
      'Anything else?',
    ].join('\n');
    expect(statedMemoryLines(reply)).toEqual([
      'Method log | sleep | worry postponement | no move | the list grew',
      'About | prefers to be asked one question at a time',
      'Do not | cheerleading for sleep | it reads as dismissal',
    ]);
  });

  it('returns nothing for an ordinary reply', () => {
    expect(statedMemoryLines('I hear you. What happened next?')).toEqual([]);
  });
});

describe('parseDistilledFacts', () => {
  it('parses a fenced JSON array and caps length and count', () => {
    const raw = '```json\n["Lives in Zürich", "Has a sister", "Runs", "Fourth"]\n```';
    expect(parseDistilledFacts(raw)).toEqual(['Lives in Zürich', 'Has a sister', 'Runs']);
    const long = JSON.stringify(['x'.repeat(500)]);
    expect(parseDistilledFacts(long)[0]).toHaveLength(MAX_MEMORY_CHARS);
  });

  it('returns [] for prose, NONE, or malformed output', () => {
    expect(parseDistilledFacts('NONE')).toEqual([]);
    expect(parseDistilledFacts('Nothing durable here.')).toEqual([]);
    expect(parseDistilledFacts('[not json')).toEqual([]);
  });
});

describe('extractCompanionMemories', () => {
  it('stores stated lines verbatim without calling the model', async () => {
    const { client, captured } = mockSupabase();
    const aiService = { chatCompletion: vi.fn() };
    await extractCompanionMemories(client, {
      ...key,
      conversationId: 'conv-1',
      userMessage: 'ok',
      assistantMessage: 'Method log | sleep | breathing | moved | slower after two minutes',
      aiService,
      model: 'm',
    });
    expect(aiService.chatCompletion).not.toHaveBeenCalled();
    expect(captured.inserted).toEqual([
      expect.objectContaining({
        assistant_id: 'comp-1',
        user_id: 'user-1',
        source: 'stated',
        source_conversation_id: 'conv-1',
        content: 'Method log | sleep | breathing | moved | slower after two minutes',
      }),
    ]);
  });

  it('does not call the model when the person disclosed nothing', async () => {
    const { client, captured } = mockSupabase();
    const aiService = { chatCompletion: vi.fn() };
    await extractCompanionMemories(client, {
      ...key,
      conversationId: null,
      userMessage: 'convert 0.1 btc to chf',
      assistantMessage: 'Late.',
      aiService,
      model: 'm',
    });
    expect(aiService.chatCompletion).not.toHaveBeenCalled();
    expect(captured.inserted).toEqual([]);
  });

  it('distils facts after self-disclosure and scopes them to the pair', async () => {
    const { client, captured } = mockSupabase();
    const aiService = {
      chatCompletion: vi.fn(async () => ({ content: '["Lives in Zürich", "Has a sister"]' })),
    };
    await extractCompanionMemories(client, {
      ...key,
      conversationId: 'conv-1',
      userMessage: 'I live in Zürich with my sister',
      assistantMessage: 'That sounds close.',
      aiService,
      model: 'm',
    });
    expect(aiService.chatCompletion).toHaveBeenCalledTimes(1);
    expect(aiService.chatCompletion.mock.calls[0][0].temperature).toBe(0);
    expect(captured.inserted.map(r => r.content)).toEqual(['Lives in Zürich', 'Has a sister']);
    expect(
      captured.inserted.every(r => r.assistant_id === 'comp-1' && r.user_id === 'user-1')
    ).toBe(true);
  });

  it('never throws when the model call fails', async () => {
    const { client } = mockSupabase();
    const aiService = {
      chatCompletion: vi.fn(async () => {
        throw new Error('429');
      }),
    };
    await expect(
      extractCompanionMemories(client, {
        ...key,
        conversationId: null,
        userMessage: 'I prefer mornings',
        assistantMessage: 'Noted.',
        aiService,
        model: 'm',
      })
    ).resolves.toBeUndefined();
  });
});

describe('rememberCompanionFacts', () => {
  it('prunes the oldest rows past the cap, within the pair and the user', async () => {
    const { client, captured } = mockSupabase({ count: MAX_MEMORIES_PER_PAIR + 1 });
    await rememberCompanionFacts(client, key, ['A new fact']);
    const prune = captured.deletes.find(f => f.some(([col]) => col === 'id'));
    expect(prune).toBeDefined();
    expect(prune).toContainEqual(['user_id', 'user-1']);
  });

  it('drops blanks and near-empty strings', async () => {
    const { client, captured } = mockSupabase();
    const result = await rememberCompanionFacts(client, key, ['  ', 'ok', 'Real fact']);
    expect(result.stored).toEqual(['Real fact']);
    expect(captured.inserted).toHaveLength(1);
  });
});

describe('deleteAllCompanionMemories', () => {
  it('filters by both the user and the companion', async () => {
    const { client, captured } = mockSupabase();
    await deleteAllCompanionMemories(client, key);
    expect(captured.deletes[0]).toEqual([
      ['user_id', 'user-1'],
      ['assistant_id', 'comp-1'],
    ]);
  });
});

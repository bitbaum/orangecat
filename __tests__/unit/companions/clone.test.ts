import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AnySupabaseClient } from '@/lib/supabase/types';

const createAssistant = vi.fn();
vi.mock('@/services/ai/assistant-service', () => ({
  createAssistant: (...args: unknown[]) => createAssistant(...args),
}));

import { cloneCompanion, COMPANION_DEFINITION_COLUMNS } from '@/services/companions/clone';

/**
 * A clone copies the definition and nothing else: the copy is private, free,
 * owned by the cloner, points at its source, and touches no memory table.
 */

const source = {
  id: 'src-1',
  title: 'Mira',
  description: 'Someone to think with',
  category: 'Companion',
  tags: ['calm'],
  avatar_url: null,
  system_prompt: 'You are Mira. You sit with a problem until it moves.',
  welcome_message: 'Take your time.',
  personality_traits: ['direct'],
  model_preference: 'any',
  max_tokens_per_response: 800,
  temperature: 0.6,
};

function mockSupabase(row: Record<string, unknown> | null, error: unknown = null) {
  const tables: string[] = [];
  const selected: string[] = [];
  const client = {
    from: (table: string) => {
      tables.push(table);
      return {
        select: (cols: string) => {
          selected.push(cols);
          return {
            eq: () => ({
              maybeSingle: async () => ({ data: row, error }),
            }),
          };
        },
      };
    },
  } as unknown as AnySupabaseClient;
  return { client, tables, selected };
}

beforeEach(() => {
  createAssistant.mockReset();
  createAssistant.mockResolvedValue({ ok: true, data: { id: 'clone-1' } });
});

describe('cloneCompanion', () => {
  it('creates a private, free copy of the definition pointing at its source', async () => {
    const { client, tables, selected } = mockSupabase(source);
    const result = await cloneCompanion(client, 'user-2', 'src-1');

    expect(result).toEqual({ ok: true, data: { id: 'clone-1' } });
    expect(tables).toEqual(['ai_assistants']);
    for (const col of COMPANION_DEFINITION_COLUMNS) {
      expect(selected[0]).toContain(col);
    }

    const [, ownerId, input, origin] = createAssistant.mock.calls[0];
    expect(ownerId).toBe('user-2');
    expect(origin).toEqual({ clonedFrom: 'src-1' });
    expect(input).toMatchObject({
      title: 'Mira',
      system_prompt: source.system_prompt,
      welcome_message: 'Take your time.',
      personality_traits: ['direct'],
      temperature: 0.6,
      max_tokens_per_response: 800,
      pricing_model: 'free',
      is_public: false,
    });
  });

  it('never reads or writes memories', async () => {
    const { client, tables } = mockSupabase(source);
    await cloneCompanion(client, 'user-2', 'src-1');
    expect(tables).not.toContain('companion_memories');
    expect(tables).not.toContain('cat_memories');
  });

  it('reports not found when RLS hides the source', async () => {
    const { client } = mockSupabase(null);
    const result = await cloneCompanion(client, 'user-2', 'src-1');
    expect(result).toEqual({ ok: false, notFound: true });
    expect(createAssistant).not.toHaveBeenCalled();
  });

  it('surfaces a database error rather than inventing a copy', async () => {
    const { client } = mockSupabase(null, { message: 'boom' });
    const result = await cloneCompanion(client, 'user-2', 'src-1');
    expect(result).toEqual({ ok: false, dbError: { message: 'boom' } });
    expect(createAssistant).not.toHaveBeenCalled();
  });
});

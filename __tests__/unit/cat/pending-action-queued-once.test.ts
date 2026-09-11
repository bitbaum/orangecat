/**
 * Seen live 2026-09-11: the free model called create_project_for_person twice
 * in one turn and two identical consent cards appeared. Confirming both would
 * have made two pages for the same person.
 */

import { vi } from 'vitest';
import { findIdenticalPending, sameParameters } from '@/services/cat/pending-dedupe';

function supabaseWith(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gt', 'order']) chain[m] = vi.fn().mockReturnThis();
  chain.limit = vi.fn().mockResolvedValue({ data: rows, error: null });
  return { from: vi.fn(() => chain) } as never;
}

const row = {
  id: 'p-1',
  action_id: 'create_project_for_person',
  category: 'entities',
  parameters: { title: 'Пекарня Оксаны', person_name: 'Оксана' },
  description: 'd',
  conversation_id: null,
  expires_at: '2999-01-01',
  grant_on_confirm: false,
};

describe('sameParameters', () => {
  it('ignores key order and nothing else', () => {
    expect(sameParameters({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(sameParameters({ a: 1 }, { a: '1' })).toBe(false);
  });
});

describe('findIdenticalPending', () => {
  it('returns the existing card for the same action and parameters', async () => {
    const found = await findIdenticalPending(
      supabaseWith([row]),
      'u',
      'create_project_for_person',
      {
        person_name: 'Оксана',
        title: 'Пекарня Оксаны',
      }
    );
    expect(found?.id).toBe('p-1');
  });

  it('returns null when the parameters differ or nothing is pending', async () => {
    expect(
      await findIdenticalPending(supabaseWith([row]), 'u', 'create_project_for_person', {
        person_name: 'Оксана',
        title: 'Другая пекарня',
      })
    ).toBeNull();
    expect(
      await findIdenticalPending(supabaseWith([]), 'u', 'create_project_for_person', {})
    ).toBeNull();
  });
});

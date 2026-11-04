import { describe, expect, it } from 'vitest';
import { getMessagesForDisplay, getMessagesForContext } from '@/services/cat/conversation-history';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DATABASE_TABLES } from '@/config/database-tables';

/** A generic ordered-row fixture: each declared ORDER BY participates before LIMIT. */
function database(failed: boolean) {
  const rows = [
    {
      id: 'u',
      role: 'user',
      content: 'question',
      created_at: '2026-11-04T14:00:00Z',
      failure: null,
    },
    {
      id: 'a',
      role: 'assistant',
      content: 'answer',
      created_at: '2026-11-04T14:00:00Z',
      failure: failed ? { kind: 'provider', code: 'AI_UNAVAILABLE', message: 'unavailable' } : null,
    },
  ];
  const ordering: Array<{ column: string; ascending: boolean }> = [];
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    order(column: string, options: { ascending: boolean }) {
      ordering.push({ column, ...options });
      return this;
    },
    async limit(limit: number) {
      return {
        data: [...rows]
          .sort((a, b) => {
            for (const { column, ascending } of ordering) {
              const value = String(a[column as keyof typeof a]).localeCompare(
                String(b[column as keyof typeof b])
              );
              if (value) {
                return ascending ? value : -value;
              }
            }
            return 0;
          })
          .slice(0, limit),
      };
    },
    async single() {
      return { data: { id: 'conversation' } };
    },
  };
  return {
    from(table: string) {
      if (
        ![DATABASE_TABLES.CAT_MESSAGES, DATABASE_TABLES.CAT_CONVERSATIONS].includes(table as never)
      ) {
        throw new Error('unexpected table');
      }
      return query;
    },
  } as unknown as AnySupabaseClient;
}

describe('paired messages with identical database timestamps', () => {
  it.each([false, true])('reopens the question before its reply (failed=%s)', async failed => {
    const messages = await getMessagesForDisplay(database(failed), 'owner', 'conversation');
    expect(messages.map(message => message.role)).toEqual(['user', 'assistant']);
  });
  it('retains a completed pair in the correct model-context order', async () => {
    expect(await getMessagesForContext(database(false), 'owner', 'conversation')).toEqual([
      { role: 'user', content: 'question' },
      { role: 'assistant', content: 'answer' },
    ]);
  });
  it('excludes the failed reply and its question from subsequent model context', async () => {
    expect(await getMessagesForContext(database(true), 'owner', 'conversation')).toEqual([]);
  });
});

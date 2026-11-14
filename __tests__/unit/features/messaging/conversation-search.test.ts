/**
 * Search inside a conversation: what matches, in what order. The ranking is
 * @bitbaum/searchkit's; this checks the part that is OrangeCat's.
 */
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/supabase/untyped', () => ({ fromTable: vi.fn() }));

import { matchingMessages, SEARCH_RESULT_LIMIT } from '@/features/messaging/server/search';

const row = (id: string, content: string, created_at: string) => ({
  id,
  conversation_id: 'c',
  sender_id: 'me',
  content,
  message_type: 'text',
  metadata: null,
  created_at,
  updated_at: created_at,
  is_deleted: false,
  edited_at: null,
});

const rows = [
  row('1', 'Penguins are basically fish', '2026-11-10T10:00:00Z'),
  row('2', 'They are birds. They have feathers.', '2026-11-10T10:01:00Z'),
  row('3', 'Are penguins fish?', '2026-11-12T10:00:00Z'),
  row('4', 'See you Saturday', '2026-11-13T10:00:00Z'),
];

describe('searching a conversation', () => {
  it('finds the messages that hold the word, and no others', () => {
    expect(matchingMessages(rows, 'feathers').map(r => r.id)).toEqual(['2']);
    expect(matchingMessages(rows, 'saturday').map(r => r.id)).toEqual(['4']);
  });

  it('forgives a typing slip', () => {
    expect(
      matchingMessages(rows, 'pengiuns')
        .map(r => r.id)
        .sort()
    ).toEqual(['1', '3']);
  });

  it('puts the newer of two equally good matches first', () => {
    expect(matchingMessages(rows, 'penguins fish').map(r => r.id)).toEqual(['3', '1']);
  });

  it('nothing asked finds nothing, and words nobody wrote find nothing', () => {
    expect(matchingMessages(rows, '   ')).toEqual([]);
    expect(matchingMessages(rows, 'volcano')).toEqual([]);
  });

  it('returns a page of matches, not the whole conversation', () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      row(String(i), 'penguin again', `2026-11-13T10:${String(i % 60).padStart(2, '0')}:00Z`)
    );
    expect(matchingMessages(many, 'penguin')).toHaveLength(SEARCH_RESULT_LIMIT);
  });
});

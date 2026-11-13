/**
 * The thread view reads a post by id in the browser. It must ask the
 * `timeline_events` table, whose SELECT policy decides who sees what — not
 * `enriched_timeline_events`, a view that runs with its owner's rights and
 * returned followers-only and private posts to anyone holding the id.
 */
import { DATABASE_TABLES } from '@/config/database-tables';

const { tables } = vi.hoisted(() => ({ tables: [] as string[] }));

vi.mock('@/lib/supabase/browser', () => {
  const from = (table: string) => {
    tables.push(table);
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: { id: 'leaked' }, error: null }),
    };
    return q;
  };
  return { default: { from } };
});
vi.mock('@/services/timeline/processors/enrichment', () => ({
  enrichEventsForDisplay: vi.fn(async (rows: unknown[]) => rows),
  attachLiveOriginalAuthors: vi.fn(),
}));

import { getEventById } from '@/services/timeline/queries/eventQueries';

describe('getEventById', () => {
  it('asks only the RLS-protected table, and finds nothing the policy withholds', async () => {
    const result = await getEventById('22222222-2222-4222-8222-222222222222');
    expect(result.success).toBe(false);
    expect(tables).toEqual([DATABASE_TABLES.TIMELINE_EVENTS]);
  });
});

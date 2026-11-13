/**
 * The signed-in Groups dashboard's Discover tab (getAvailableGroups).
 *
 * On 2026-11-12 it read "Discover (8)" and listed three CI audit groups
 * ("Audit WF009b 1783192620260", "Audit WF009 1783192171482", "Audit Group
 * 1783191071580") among the five real ones, and every card said "0 members"
 * though each group page showed its founder. Public Discover already hid those
 * groups by name; this list asked for every public group and no member count.
 */
vi.mock('@/lib/supabase/browser', () => ({ default: {} }));
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { FIXTURE_GROUP_NAME_PATTERNS } from '@/config/public-directory';
import { getAvailableGroups, getUserGroups } from '@/services/groups/queries/groups';
import type { AnySupabaseClient } from '@/lib/supabase/types';

type Call = [method: string, ...args: unknown[]];

/** A PostgREST builder that records each call and answers with `rows`. */
function client(rows: unknown[], memberships: unknown[] = []) {
  const calls: Record<string, Call[]> = {};
  const from = (table: string) => {
    const log: Call[] = (calls[table] ??= []);
    const result =
      table === 'group_members'
        ? { data: memberships, error: null }
        : { data: rows, error: null, count: rows.length };
    const chain: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    };
    for (const method of ['select', 'eq', 'not', 'in', 'is', 'contains', 'order', 'range']) {
      chain[method] = (...args: unknown[]) => {
        log.push([method, ...args]);
        return chain;
      };
    }
    return chain;
  };
  const sb = {
    from,
    auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) },
  } as unknown as AnySupabaseClient;
  return { sb, calls };
}

const group = (name: string, count?: number) => ({
  id: name,
  name,
  slug: name.toLowerCase().replace(/\W+/g, '-'),
  label: 'circle',
  is_public: true,
  ...(count === undefined ? {} : { member_count: [{ count }] }),
});

describe('the dashboard Discover tab', () => {
  it('leaves out the groups CI and audits mint, by the rule Discover uses', async () => {
    const { sb, calls } = client([group('Zurich Record Shop', 1)]);
    await getAvailableGroups(undefined, undefined, sb);

    const filters = calls.groups.filter(([method]) => method === 'not');
    expect(filters).toEqual(
      FIXTURE_GROUP_NAME_PATTERNS.map(pattern => ['not', 'name', 'imatch', pattern])
    );
    expect(calls.groups).toContainEqual(['eq', 'is_public', true]);
  });

  it('counts each group’s members instead of leaving the card to say 0', async () => {
    const { sb, calls } = client([group('Orange Cat', 1), group('Bitcoin Developers Circle', 3)]);
    const { groups } = await getAvailableGroups(undefined, undefined, sb);

    const [, columns] = calls.groups.find(([method]) => method === 'select') ?? [];
    expect(columns).toMatch(/member_count:group_members\(count\)/);
    expect(groups?.map(g => [g.name, (g as { member_count?: number }).member_count])).toEqual([
      ['Orange Cat', 1],
      ['Bitcoin Developers Circle', 3],
    ]);
  });

  it('counts the members of your own groups the same way', async () => {
    const { sb } = client([group('Orange Cat', 2)], [{ group_id: 'Orange Cat' }]);
    const { groups } = await getUserGroups(undefined, undefined, sb);
    expect((groups?.[0] as { member_count?: number }).member_count).toBe(2);
  });

  it('knows no count when none came back', async () => {
    const { sb } = client([group('Orange Cat')]);
    const { groups } = await getAvailableGroups(undefined, undefined, sb);
    expect((groups?.[0] as { member_count?: number }).member_count).toBeUndefined();
  });
});

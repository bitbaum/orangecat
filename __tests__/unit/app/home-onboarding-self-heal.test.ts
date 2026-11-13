/**
 * `/` sends a signed-in person whose onboarding flag is unset to the wizard —
 * unless they already own something, in which case the flag is stale and is
 * healed. Only projects used to count, so someone with a product, a wallet or
 * a group was sent back to "Tell Cat who you are" on every visit.
 */

import { ROUTES } from '@/config/routes';

const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { url });
  })
);
const client = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => client.current,
}));
vi.mock('@/domain/actors', () => ({
  getUserActorIds: async () => ['actor-1'],
}));

type Row = { table: string; column: string; owner: string };

/** A client whose rows are `owned`; head counts honour the owner filter. */
function fakeClient(owned: Row[]) {
  const profileUpdates: unknown[] = [];
  const count = (table: string, match: (r: Row) => boolean) =>
    Promise.resolve({
      count: owned.filter(r => r.table === table && match(r)).length,
      error: null,
    });
  return {
    profileUpdates,
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from(table: string) {
      return {
        select: (_columns: string, options?: { head?: boolean }) =>
          options?.head
            ? {
                eq: (column: string, value: string) =>
                  count(table, r => r.column === column && r.owner === value),
                in: (column: string, values: string[]) =>
                  count(table, r => r.column === column && values.includes(r.owner)),
              }
            : {
                eq: () => ({
                  single: async () => ({ data: { onboarding_completed: false }, error: null }),
                }),
              },
        update: (row: unknown) => {
          profileUpdates.push({ table, row });
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  };
}

async function landOnHome(owned: Row[]) {
  const fake = fakeClient(owned);
  client.current = fake;
  const { default: Home } = await import('@/app/page');
  const thrown = await Home().then(
    () => null,
    (e: { url?: string }) => e
  );
  return { url: thrown?.url, profileUpdates: fake.profileUpdates };
}

beforeEach(() => {
  redirect.mockClear();
});

describe('/ for a signed-in person who never finished onboarding', () => {
  it.each<[string, Row]>([
    ['a product', { table: 'user_products', column: 'actor_id', owner: 'actor-1' }],
    ['a wallet', { table: 'wallets', column: 'profile_id', owner: 'user-1' }],
    ['a group they made', { table: 'groups', column: 'created_by', owner: 'user-1' }],
    ['a project', { table: 'projects', column: 'actor_id', owner: 'actor-1' }],
  ])('owning %s goes to the Cat and heals the flag', async (_label, row) => {
    const { url, profileUpdates } = await landOnHome([row]);

    expect(url).toBe(ROUTES.DASHBOARD.CAT);
    expect(profileUpdates).toEqual([{ table: 'profiles', row: { onboarding_completed: true } }]);
  });

  it('owning nothing goes to the Cat welcome, the first screen every way in shares', async () => {
    const { url, profileUpdates } = await landOnHome([
      // someone else's product
      { table: 'user_products', column: 'actor_id', owner: 'actor-2' },
    ]);

    // Not the onboarding form: the logo opened it on every visit (auth-firstrun
    // #1). The welcome links to it.
    expect(url).toBe(ROUTES.DASHBOARD.CAT_WELCOME);
    expect(profileUpdates).toEqual([]);
  });
});

/**
 * /api/research listed drafts to everyone: a draft marked public appeared in
 * the open list, and ?user_id= returned a stranger's whole list, drafts and
 * private topics included. Only the owner sees their own drafts now.
 */
const { viewer, calls } = vi.hoisted(() => ({
  viewer: { id: null as string | null },
  calls: [] as string[][],
}));

function chain(tag: string) {
  const q: Record<string, unknown> = {};
  const rec =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([tag, name, ...args.map(String)]);
      return q;
    };
  for (const m of ['select', 'order', 'range', 'eq', 'neq', 'contains']) {
    q[m] = rec(m);
  }
  q.then = (resolve: (v: unknown) => void) =>
    resolve(tag === 'items' ? { data: [], error: null } : { count: 0, error: null });
  return q;
}

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => {
    let n = 0;
    return {
      auth: { getUser: async () => ({ data: { user: viewer.id ? { id: viewer.id } : null } }) },
      from: () => chain(n++ === 0 ? 'items' : 'count'),
    };
  },
}));
vi.mock('@/services/actors/getOrCreateUserActor', () => ({
  getOrCreateUserActor: async (id: string) => ({ id: `actor-${id}` }),
}));
vi.mock('@/lib/api/compose', () => ({
  compose: () => (handler: unknown) => handler,
}));

import { GET } from '@/app/api/research/route';

const hidesDrafts = () =>
  calls.some(c => c[0] === 'items' && c[1] === 'neq' && c[2] === 'status' && c[3] === 'draft') &&
  calls.some(c => c[0] === 'items' && c[1] === 'eq' && c[2] === 'is_public' && c[3] === 'true');

describe('GET /api/research', () => {
  beforeEach(() => {
    calls.length = 0;
    viewer.id = null;
  });

  it('shows a visitor only public, published topics', async () => {
    await GET(new Request('https://orangecat.ch/api/research') as never);
    expect(hidesDrafts()).toBe(true);
  });

  it('does not open a stranger’s list with ?user_id=', async () => {
    viewer.id = 'someone-else';
    await GET(new Request('https://orangecat.ch/api/research?user_id=owner') as never);
    expect(hidesDrafts()).toBe(true);
  });

  it('shows the owner their own drafts', async () => {
    viewer.id = 'owner';
    await GET(new Request('https://orangecat.ch/api/research?user_id=owner') as never);
    expect(hidesDrafts()).toBe(false);
    expect(calls.some(c => c[1] === 'eq' && c[2] === 'actor_id' && c[3] === 'actor-owner')).toBe(
      true
    );
  });
});

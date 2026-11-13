/**
 * People → Everyone: fixtures and nameless `user_…` shells are filtered in the
 * query, BEFORE the range, and search reaches the server and matches names.
 * Filtering after the range left a page of 11 nameless sign-ups and a search
 * for "marco" that could never reach Marco Rossi.
 */
import {
  NOT_A_FIXTURE_NAME,
  NOT_A_NAMELESS_SHELL,
  onlyPublicPeople,
} from '@/domain/people/publicPeopleFilter';
import {
  EXACT_FIXTURE_USERNAMES,
  FIXTURE_USERNAME_ILIKE_PATTERNS,
  isFixtureDisplayName,
} from '@/config/public-directory';
import { isMintedHandle } from '@/config/usernames';

type Op = [string, ...unknown[]];
const ops: Op[] = [];
let rows: unknown[] = [];

function builder() {
  const b: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'not', 'neq', 'or', 'order', 'range']) {
    b[m] = (...args: unknown[]) => {
      ops.push([m, ...args]);
      return b;
    };
  }
  b.then = (ok: (v: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: null, count: rows.length }).then(ok);
  return b;
}

// The suite aliases next/server to a stub; this test reads a real body.
vi.mock('next/server', async () => ({
  NextResponse: (await import('next/dist/server/web/spec-extension/response')).NextResponse,
}));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: () => builder() }));
vi.mock('@/lib/api/withAuth', () => ({
  withAuth:
    (handler: (req: unknown) => Promise<unknown>) =>
    (req: unknown): Promise<unknown> =>
      handler(Object.assign(req as object, { user: { id: 'me' }, supabase: {} })),
}));

const request = (qs: string) => ({ nextUrl: new URL(`http://localhost/api/profiles?${qs}`) });

beforeEach(() => {
  ops.length = 0;
  rows = [];
});

describe('onlyPublicPeople', () => {
  it('applies every fixture rule and the nameless-shell rule as filters', () => {
    onlyPublicPeople(builder());
    expect(ops).toContainEqual(['not', 'username', 'is', null]);
    for (const p of FIXTURE_USERNAME_ILIKE_PATTERNS) {
      expect(ops).toContainEqual(['not', 'username', 'ilike', p]);
    }
    for (const n of EXACT_FIXTURE_USERNAMES) {
      expect(ops).toContainEqual(['neq', 'username', n]);
    }
    expect(ops).toContainEqual(['or', NOT_A_NAMELESS_SHELL]);
    expect(ops).toContainEqual(['or', NOT_A_FIXTURE_NAME]);
  });

  it('the SQL patterns are the JS predicates, quoted for PostgREST', () => {
    expect(NOT_A_NAMELESS_SHELL).toBe(
      'username.not.imatch."^user_[0-9a-f]{8,}$",name.imatch."\\\\S"'
    );
    expect(isMintedHandle('user_e00864455095')).toBe(true);
    expect(NOT_A_FIXTURE_NAME).toContain('name.is.null');
    expect(isFixtureDisplayName('QA Grok A')).toBe(true);
    expect(isFixtureDisplayName('E2E User')).toBe(true);
    expect(isFixtureDisplayName('Messaging Test User')).toBe(true);
    expect(isFixtureDisplayName('Test Service User')).toBe(true);
    expect(isFixtureDisplayName('Marco Rossi')).toBe(false);
    expect(isFixtureDisplayName('Contest Winner')).toBe(false);
  });
});

describe('GET /api/profiles', () => {
  it('filters before it pages, and pages last', async () => {
    const { GET } = await import('@/app/api/profiles/route');
    await (GET as unknown as (r: unknown) => Promise<Response>)(request('limit=100'));
    const names = ops.map(o => o[0]);
    const lastFilter = Math.max(names.lastIndexOf('not'), names.lastIndexOf('or'));
    expect(names.indexOf('range')).toBeGreaterThan(lastFilter);
    expect(ops).toContainEqual(['range', 0, 99]);
  });

  it('a search matches handle or display name on the server', async () => {
    const { GET } = await import('@/app/api/profiles/route');
    await (GET as unknown as (r: unknown) => Promise<Response>)(request('search=marco'));
    expect(ops).toContainEqual(['or', 'username.ilike."%marco%",name.ilike."%marco%"']);
  });

  it('never returns the email it selected for the filter', async () => {
    rows = [{ id: '1', username: 'marco', name: 'Marco Rossi', email: 'x@example.com' }];
    const { GET } = await import('@/app/api/profiles/route');
    const res = await (GET as unknown as (r: unknown) => Promise<Response>)(request(''));
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('x@example.com');
    expect(JSON.stringify(body)).toContain('Marco Rossi');
  });
});

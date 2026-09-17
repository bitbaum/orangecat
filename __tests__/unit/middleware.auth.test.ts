// Mock NextResponse to avoid depending on Next.js internals during unit tests
const nextHeaders = () => {
  const store = new Map<string, string>();
  return {
    set: (key: string, value: string) => store.set(key, value),
    get: (key: string) => store.get(key) || null,
  };
};

const nextResponseNext = () => ({
  headers: nextHeaders(),
  cookies: {
    set: () => {},
    get: () => undefined,
  },
});

vi.mock('next/server', () => ({
  NextResponse: {
    next: () => nextResponseNext(),
    redirect: (url: URL) => ({
      status: 307,
      headers: {
        get: (key: string) => (key === 'location' ? url.toString() : null),
        set: () => {},
      },
    }),
  },
  NextRequest: class {},
  NextFetchEvent: class {},
}));

// Mock @supabase/ssr so middleware doesn't try to hit the real Supabase
// instance during tests. The mocked client's getUser() is configurable
// per-test via setMockUser().
let mockUser: { id: string } | null = null;
const setMockUser = (user: { id: string } | null) => {
  mockUser = user;
};
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: mockUser }, error: null }),
    },
  }),
}));

import { middleware } from '@/middleware';

// Minimal NextRequest stub for middleware tests
function buildRequest(path: string, cookies: Record<string, string> = {}) {
  const cookieMap = new Map(Object.entries(cookies));

  return {
    nextUrl: new URL(`https://example.com${path}`),
    cookies: {
      get: (name: string) =>
        cookieMap.has(name) ? { name, value: cookieMap.get(name) as string } : undefined,
      getAll: () =>
        Array.from(cookieMap.entries()).map(([name, value]) => ({
          name,
          value,
        })),
      set: () => {},
    },
    headers: new Headers(),
    url: `https://example.com${path}`,
  };
}

describe('middleware auth protection', () => {
  const realEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...realEnv };
    setMockUser(null);
  });

  afterEach(() => {
    process.env = realEnv;
  });

  it('allows public route without auth', async () => {
    const req = buildRequest('/');
    const res = await middleware(req as any);
    expect(res?.status).toBeUndefined(); // NextResponse.next()
  });

  it('redirects to /auth when accessing a protected route signed out', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    setMockUser(null);

    const req = buildRequest('/dashboard');
    const res = await middleware(req as any);

    expect(res?.status).toBe(307);
    expect(res?.headers.get('location')).toContain('/auth');
    expect(res?.headers.get('location')).toContain('from=%2Fdashboard');
  });

  it('allows a protected route through when @supabase/ssr returns a user', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    setMockUser({ id: 'user-123' });

    const req = buildRequest('/dashboard');
    const res = await middleware(req as any);

    expect(res?.status).toBeUndefined(); // NextResponse.next()
  });
});

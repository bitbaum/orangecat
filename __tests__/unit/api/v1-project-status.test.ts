/**
 * PATCH /api/v1/projects/[id] — the endpoint that makes unpublishing possible.
 *
 * Publishing from another product was one-way: POST /api/v1/projects created a
 * public page, and the only way to change its status lived behind session auth,
 * which a bearer-token integration cannot use. So a project published from
 * FleetCrown stayed publicly visible for good.
 *
 * These tests pin the parts that make a write surface safe to expose: a scope
 * is required, someone else's project cannot be touched, transitions are the
 * SAME ones the internal route allows, and a repeated unpublish is not an error.
 */
import { PATCH } from '@/app/api/v1/projects/[id]/route';
import { resolveRequestAuth } from '@/lib/api/resolveRequestAuth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAllowedStatusTransitions } from '@/config/entity-status';
import { VALID_PROJECT_STATUSES } from '@/config/project-statuses';
import type { MockedFunction } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/api/resolveRequestAuth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/resolveRequestAuth')>(
    '@/lib/api/resolveRequestAuth'
  );
  return { ...actual, resolveRequestAuth: vi.fn() };
});
// next/server is aliased to a stub suite-wide (see vitest.config.ts), so
// NextResponse.json returns undefined. Route tests here assert on the response
// helpers instead — same convention as receive-request.test.ts.
vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: vi.fn((data: unknown) => ({ status: 200, data })),
  apiError: vi.fn((message: string, _code: string, status: number) => ({ status, message })),
  apiNotFound: vi.fn((message: string) => ({ status: 404, message })),
  apiValidationError: vi.fn((message: string) => ({ status: 422, message })),
  apiRateLimited: vi.fn(() => ({ status: 429 })),
  handleSupabaseError: vi.fn(() => ({ status: 500 })),
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: vi.fn().mockResolvedValue({ success: true }),
  rateLimitIntegrationKeyWrite: vi.fn().mockResolvedValue({ success: true }),
  retryAfterSeconds: () => 1,
}));

const mockAuth = resolveRequestAuth as MockedFunction<typeof resolveRequestAuth>;
const mockAdmin = createAdminClient as MockedFunction<typeof createAdminClient>;

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const OWNER = 'owner-user-id';

function authAs(overrides: Record<string, unknown> = {}) {
  mockAuth.mockResolvedValue({
    userId: OWNER,
    scopes: ['project.write'],
    source: 'oidc',
    ...overrides,
  } as never);
}

/** A Supabase double that answers the one select and records the one update. */
function supabaseWith(row: { user_id: string; status: string } | null) {
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  mockAdmin.mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () =>
            row
              ? { data: { id: PROJECT_ID, ...row }, error: null }
              : { data: null, error: { message: 'no rows' } },
        }),
      }),
      update,
    }),
  } as never);
  return update;
}

// The route reads only `json()` off the request; a real NextRequest needs a
// fetch environment these unit tests deliberately do not build.
function req(body: unknown) {
  return { json: () => Promise.resolve(body) } as never;
}
const ctx = { params: Promise.resolve({ id: PROJECT_ID }) };

beforeEach(() => vi.clearAllMocks());

describe('who may call it', () => {
  it('refuses an unauthenticated request', async () => {
    mockAuth.mockResolvedValue(null);
    expect((await PATCH(req({ status: 'draft' }), ctx)).status).toBe(401);
  });

  it('refuses a token without the write scope — read access is not write access', async () => {
    authAs({ scopes: ['project.read'] });
    expect((await PATCH(req({ status: 'draft' }), ctx)).status).toBe(403);
  });

  it("refuses to touch someone else's project, even with the scope", async () => {
    authAs();
    supabaseWith({ user_id: 'a-different-user', status: 'active' });
    const res = await PATCH(req({ status: 'draft' }), ctx);
    expect(res.status).toBe(403);
  });

  it('404s a project that does not exist', async () => {
    authAs();
    supabaseWith(null);
    expect((await PATCH(req({ status: 'draft' }), ctx)).status).toBe(404);
  });
});

describe('what it accepts', () => {
  it('unpublishes: active → draft, which is owner-only', async () => {
    authAs();
    const update = supabaseWith({ user_id: OWNER, status: 'active' });
    const res = await PATCH(req({ status: 'draft' }), ctx);
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }));
  });

  it('is idempotent — unpublishing twice is not a failure', async () => {
    authAs();
    const update = supabaseWith({ user_id: OWNER, status: 'draft' });
    const res = await PATCH(req({ status: 'draft' }), ctx);
    expect(res.status).toBe(200);
    expect(res).toMatchObject({ data: { changed: false } });
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses a status that is not a status', async () => {
    authAs();
    supabaseWith({ user_id: OWNER, status: 'active' });
    expect((await PATCH(req({ status: 'unpublished' }), ctx)).status).toBe(422);
  });

  it('enforces the SHARED transition rules, not a second set of its own', async () => {
    // Derived from the config rather than hardcoded: if someone widens the
    // transitions later, this test follows them instead of failing for a
    // change that was deliberate. What it pins is that v1 asks the same
    // question the internal route asks.
    const from = 'paused';
    const allowed = getAllowedStatusTransitions(from);
    const refused = VALID_PROJECT_STATUSES.find(s => s !== from && !allowed.includes(s));
    expect(refused, 'the config should refuse at least one transition').toBeTruthy();
    authAs();
    supabaseWith({ user_id: OWNER, status: from });
    const res = await PATCH(req({ status: refused }), ctx);
    expect(res.status).toBe(422);
  });

  it('requires a status at all', async () => {
    authAs();
    supabaseWith({ user_id: OWNER, status: 'active' });
    expect((await PATCH(req({}), ctx)).status).toBe(422);
  });
});

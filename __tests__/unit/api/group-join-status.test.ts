/**
 * POST /api/groups/<slug>/members answers an ordinary refusal with a 4xx.
 *
 * join_public_group refuses a closed group, an existing member and a signed-out
 * caller in plain words. The route turned every one of them into a 500, so an
 * expected answer was logged and alerted as a server fault (adversarial
 * review of #1670). A 500 stays for a real failure only.
 */

vi.mock('next/server', () => ({
  NextRequest: class NextRequest {},
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      status: (init as { status?: number })?.status ?? 200,
      headers: new Headers(init?.headers),
      json: async () => data,
    }),
    redirect: vi.fn(),
    next: vi.fn(),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/supabase/browser', () => ({ default: {} }));
vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));

vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: vi.fn(async () => ({ success: true })),
  retryAfterSeconds: vi.fn(() => 1),
}));

const GROUP_ID = '33333333-3333-4333-8333-333333333333';
const rpcResult: { data?: unknown; error?: unknown } = {};

function stubClient() {
  const group = { id: GROUP_ID, name: 'Open', slug: 'open' };
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.single = async () => ({ data: group, error: null });
  builder.maybeSingle = async () => ({ data: group, error: null });
  builder.insert = async () => ({ error: null });
  return {
    from: () => builder,
    rpc: vi.fn(async () => ({ data: null, error: null, ...rpcResult })),
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
  };
}

vi.mock('@/lib/api/withAuth', () => ({
  withAuth:
    (handler: (req: unknown, ctx: unknown) => Promise<Response>) =>
    (req: Record<string, unknown>, ctx: unknown) =>
      handler({ ...req, supabase: stubClient(), user: { id: 'u1' } }, ctx),
  withOptionalAuth: (handler: unknown) => handler,
}));

vi.mock('@/services/groups', async () => {
  const members = await import('@/services/groups/mutations/members');
  return {
    default: {
      getGroup: vi.fn(async () => ({
        success: true,
        group: { id: GROUP_ID, name: 'Open', slug: 'open' },
      })),
      joinGroup: members.joinGroup,
    },
  };
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

async function post() {
  const { POST } = await import('@/app/api/groups/[slug]/members/route');
  const response = await POST({} as never, { params: Promise.resolve({ slug: 'open' }) } as never);
  return { status: response.status, body: await response.json() };
}

function refuse(code: string, error: string) {
  rpcResult.data = { success: false, code, error };
  rpcResult.error = undefined;
}

describe('POST /api/groups/<slug>/members — refusals are 4xx', () => {
  beforeEach(() => {
    rpcResult.data = undefined;
    rpcResult.error = undefined;
  });

  it('a closed group is 403 with the sentence', async () => {
    refuse('invitation_only', 'This group takes new members by invitation only');
    const { status, body } = await post();
    expect(status).toBe(403);
    expect(body.error.message).toBe('This group takes new members by invitation only');
  });

  it('an existing member is 409', async () => {
    refuse('already_member', 'You are already a member of this group');
    const { status, body } = await post();
    expect(status).toBe(409);
    expect(body.error.message).toBe('You are already a member of this group');
  });

  it('a caller the database sees as signed out is 401', async () => {
    refuse('not_signed_in', 'Sign in to join this group');
    expect((await post()).status).toBe(401);
  });

  it('a database failure is still a 500, without its text', async () => {
    rpcResult.error = { message: 'connection reset' };
    const { status, body } = await post();
    expect(status).toBe(500);
    expect(body.error.message).not.toMatch(/connection reset/);
  });

  it('a refusal without a known code is not dressed up as a 4xx', async () => {
    rpcResult.data = { success: false, error: 'Something unexpected' };
    expect((await post()).status).toBe(500);
  });

  it('a join is 201', async () => {
    rpcResult.data = { success: true, group_id: GROUP_ID };
    expect((await post()).status).toBe(201);
  });
});

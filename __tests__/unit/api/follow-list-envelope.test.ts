/**
 * Contract test: the follow-list route's envelope and the client's unwrap.
 *
 * The bug this pins: /api/social/following/[id] answers
 *   { success: true, data: { data: [...], pagination } }
 * and the profile page read `data.data` — the OBJECT — through an
 * `Array.isArray()` guard. The guard failed silently, so `isFollowing` stayed
 * false forever, the button always read "Follow", and clicking it on someone
 * you already followed returned 409 "Already following this user".
 *
 * The assertions below run the REAL route factory and feed its REAL output to
 * the client parser, so moving either side without the other fails here.
 */

// The global __mocks__/next-server.js stubs NextResponse.json as a bare vi.fn()
// (→ undefined), so route handlers return nothing. Give it a real-ish
// implementation, matching standardResponse.contract.test.ts.
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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseFollowListResponse, type FollowListRow } from '@/services/social/followList';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

const FOLLOW_ROW = {
  following_id: BOB,
  created_at: '2026-07-04T18:54:38.990509+00:00',
  profile: {
    id: BOB,
    username: 'bob',
    name: 'Bob',
    avatar_url: null,
    bio: null,
    bitcoin_address: null,
    lightning_address: null,
  },
};

/** Minimal supabase query-builder stub: every chained call returns `this`. */
function stubSupabase(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.range = vi.fn(async () => ({ data: rows, error: null, count: rows.length }));
  return { from: vi.fn(() => builder) };
}

vi.mock('@/lib/api/withAuth', () => ({
  // The follow-list routes use withOptionalAuth; hand the handler a stub client.
  withOptionalAuth:
    (handler: (req: unknown, ctx: unknown) => Promise<Response>) =>
    (req: Record<string, unknown>, ctx: unknown) =>
      handler({ ...req, supabase: stubSupabase([FOLLOW_ROW]), user: null }, ctx),
}));

describe('follow-list envelope contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('the route nests rows two levels deep under data.data', async () => {
    const { createFollowListRoute } = await import('@/lib/api/followListRoute');
    const GET = createFollowListRoute('following');

    const response = await GET(
      { url: `https://orangecat.ch/api/social/following/${ALICE}` } as never,
      { params: Promise.resolve({ id: ALICE }) } as never
    );
    const body = await response.json();

    expect(body.success).toBe(true);
    // The shape that broke the caller: data is an OBJECT, not an array.
    expect(Array.isArray(body.data)).toBe(false);
    expect(Array.isArray(body.data.data)).toBe(true);
  });

  it('the client parser reads the real route output', async () => {
    const { createFollowListRoute } = await import('@/lib/api/followListRoute');
    const GET = createFollowListRoute('following');

    const response = await GET(
      { url: `https://orangecat.ch/api/social/following/${ALICE}` } as never,
      { params: Promise.resolve({ id: ALICE }) } as never
    );
    const rows = parseFollowListResponse(await response.json());

    expect(rows).toHaveLength(1);
    expect(rows[0]?.following_id).toBe(BOB);
    // The joined profile is aliased `profile` (singular) by the route.
    expect(rows[0]?.profile?.username).toBe('bob');
  });

  it('a follow-status check over the parsed rows sees an existing follow', async () => {
    const { createFollowListRoute } = await import('@/lib/api/followListRoute');
    const GET = createFollowListRoute('following');

    const response = await GET(
      { url: `https://orangecat.ch/api/social/following/${ALICE}` } as never,
      { params: Promise.resolve({ id: ALICE }) } as never
    );
    const rows: FollowListRow[] = parseFollowListResponse(await response.json());
    const followingIds = rows
      .map(row => row.following_id ?? row.profile?.id)
      .filter((id): id is string => Boolean(id));

    // Regression: this was false, so the button offered "Follow" to someone
    // Alice already followed and the POST came back 409.
    expect(followingIds.includes(BOB)).toBe(true);
  });

  it('degrades to an empty list rather than throwing on unexpected shapes', () => {
    expect(parseFollowListResponse(null)).toEqual([]);
    expect(parseFollowListResponse({ success: false })).toEqual([]);
    expect(parseFollowListResponse({ success: true, data: null })).toEqual([]);
    expect(parseFollowListResponse({ success: true, data: {} })).toEqual([]);
  });

  it('also accepts a flat array, so a future un-nesting of the route stays safe', () => {
    expect(parseFollowListResponse({ success: true, data: [FOLLOW_ROW] })).toHaveLength(1);
  });
});

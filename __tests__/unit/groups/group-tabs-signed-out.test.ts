/**
 * A public group's Events and Activity tabs answer a signed-out visitor.
 *
 * Measured on orangecat.ch 2026-11-12, signed out, at 390px and on desktop:
 * GET /api/groups/<slug>/events and GET /api/groups/<slug>/activities both
 * answered 401 for bitcoin-education-foundation and zurich-record-shop, so the
 * Events tab said "Couldn't load events. Try again" and the Activity tab
 * "Could not load activity. Try refreshing the page." Signed in as someone
 * outside the group, Activity answered 200 with no rows (the table's row
 * policy is members-only) and the tab said "No activity yet", which was not
 * true either.
 *
 * Now: events are listed for anyone who can see the group (the row policy
 * decides which). Activity tells a non-member, signed in or out, that the feed
 * is for members, and never reads the table for them.
 */

import { NextRequest } from 'next/server';

// The suite aliases next/server to a stub (vitest.config.ts); these tests read
// real status codes and bodies, so they load the real classes.
vi.mock('next/server', async () => ({
  NextRequest: (await import('next/dist/server/web/spec-extension/request')).NextRequest,
  NextResponse: (await import('next/dist/server/web/spec-extension/response')).NextResponse,
}));

type Result = { data: unknown; error: unknown; count?: number | null };

interface FakeClient {
  queried: string[];
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null }; error: null }> };
  from: (table: string) => unknown;
}

let serverClient: FakeClient;
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => serverClient,
}));
vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: async () => ({ success: true }),
  retryAfterSeconds: () => 60,
}));
vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/services/groups/activities', () => ({ recordGroupActivity: vi.fn() }));

import { GET as getEvents } from '@/app/api/groups/[slug]/events/route';
import { GET as getActivities } from '@/app/api/groups/[slug]/activities/route';

const GROUP_ID = '0b8f9a52-3f2e-4c4f-9d1a-7d6c1b2a3e4f';
const SLUG = 'bitcoin-education-foundation';
const VISITOR = { id: '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f' };
const MEMBER = { id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d' };

const PUBLIC_EVENT = {
  id: 'e1',
  group_id: GROUP_ID,
  creator_id: MEMBER.id,
  title: 'Bitcoin basics meetup',
  is_public: true,
  starts_at: '2099-01-01T18:00:00.000Z',
  rsvps: [],
};
const ACTIVITY = {
  id: 'a1',
  activity_type: 'joined_group',
  metadata: {},
  created_at: '2026-11-01T10:00:00.000Z',
  user_id: MEMBER.id,
};

/** A PostgREST-shaped client: every table answers what `tables` says. */
function fakeClient(
  user: { id: string } | null,
  tables: Record<string, (filters: Record<string, unknown>) => Result>
): FakeClient {
  const queried: string[] = [];
  return {
    queried,
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table: string) {
      queried.push(table);
      const filters: Record<string, unknown> = {};
      const answer = () => (tables[table] ? tables[table](filters) : { data: null, error: null });
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'order', 'range', 'gte', 'lt', 'limit', 'in']) {
        builder[method] = () => builder;
      }
      builder.eq = (column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      };
      builder.single = async () => answer();
      builder.maybeSingle = async () => answer();
      builder.then = (ok: (r: Result) => unknown, ko: (e: unknown) => unknown) =>
        Promise.resolve(answer()).then(ok, ko);
      return builder;
    },
  };
}

/** The live tables for a public group with one member and one public event. */
function publicGroupTables() {
  return {
    groups: () => ({ data: { id: GROUP_ID, name: 'Bitcoin Education Foundation' }, error: null }),
    group_events: () => ({ data: [PUBLIC_EVENT], error: null, count: 1 }),
    group_members: (filters: Record<string, unknown>) => ({
      data: filters.user_id === MEMBER.id ? { id: 'm1' } : null,
      error: null,
    }),
    group_activities: () => ({ data: [ACTIVITY], error: null }),
    profiles: () => ({
      data: [{ id: MEMBER.id, name: 'Member', username: 'member', avatar_url: null }],
      error: null,
    }),
  };
}

const ctx = () => ({ params: Promise.resolve({ slug: SLUG }) });
const req = (path: string) => new NextRequest(`https://orangecat.ch/api/groups/${SLUG}/${path}`);

describe('Events tab, signed out', () => {
  it('lists the public events instead of answering 401', async () => {
    serverClient = fakeClient(null, publicGroupTables());
    const res = await getEvents(req('events?status=upcoming&limit=50'), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.events.map((e: { id: string }) => e.id)).toEqual(['e1']);
    expect(body.data.total).toBe(1);
  });

  it('still answers 404 for a group the visitor cannot see', async () => {
    serverClient = fakeClient(null, {
      ...publicGroupTables(),
      groups: () => ({ data: null, error: { code: 'PGRST116' } }),
    });
    const res = await getEvents(req('events'), ctx());
    expect(res.status).toBe(404);
  });
});

describe('Activity tab', () => {
  it('tells a signed-out visitor the feed is for members, without reading it', async () => {
    serverClient = fakeClient(null, publicGroupTables());
    const res = await getActivities(req('activities'), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ activities: [], membersOnly: true });
    expect(serverClient.queried).not.toContain('group_activities');
  });

  it('tells a signed-in non-member the same, not "no activity"', async () => {
    serverClient = fakeClient(VISITOR, publicGroupTables());
    const res = await getActivities(req('activities'), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ activities: [], membersOnly: true });
    expect(serverClient.queried).not.toContain('group_activities');
  });

  it("shows a member the group's activity", async () => {
    serverClient = fakeClient(MEMBER, publicGroupTables());
    const res = await getActivities(req('activities'), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.membersOnly).toBe(false);
    expect(body.data.activities).toHaveLength(1);
    expect(body.data.activities[0].user.name).toBe('Member');
  });
});

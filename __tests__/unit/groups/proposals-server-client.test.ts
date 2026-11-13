/**
 * Group governance reads through the per-request server client.
 *
 * The group services take an optional client and fall back to the browser
 * client when given none. That client cannot run on the server — @supabase/ssr
 * throws "createBrowserClient requires configuring a getAll and setAll cookie
 * method" — and the services catch the throw and report the group as missing.
 *
 * Measured on orangecat.ch 2026-11-12: GET /api/groups/<slug> answered 200 while
 * GET /api/groups/<slug>/proposals answered 404 "Group not found" for the same
 * public group, signed in or out; /groups/<slug>/proposals was a 404 page; the
 * group page's Proposals tab said "Couldn't load proposals". The proposals
 * route and both proposals pages were the only group call sites on the server
 * that passed no client.
 *
 * The browser client here throws exactly as it does on the server, so any call
 * site that forgets the server client fails these tests.
 */

import { NextRequest } from 'next/server';

// The suite aliases next/server to a stub (vitest.config.ts); these tests read
// real status codes and bodies, so they load the real classes.
vi.mock('next/server', async () => ({
  NextRequest: (await import('next/dist/server/web/spec-extension/request')).NextRequest,
  NextResponse: (await import('next/dist/server/web/spec-extension/response')).NextResponse,
}));

vi.mock('@/lib/supabase/browser', () => {
  const unusable = () => {
    throw new Error('createBrowserClient requires configuring a getAll and setAll cookie method');
  };
  return {
    default: {
      auth: { getUser: unusable, getSession: unusable, onAuthStateChange: unusable },
      from: unusable,
      rpc: unusable,
    },
  };
});

let serverClient: unknown;
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
vi.mock('@/services/groups/mutations/proposals', () => ({
  createProposal: vi.fn(async (input: { group_id: string; title: string }) => ({
    success: true,
    proposal: { id: 'p1', ...input },
  })),
}));
vi.mock('@/services/groups/activities', () => ({ recordGroupActivity: vi.fn() }));

class NotFound extends Error {}
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new NotFound('NEXT_NOT_FOUND');
  },
}));
vi.mock('@/app/groups/[slug]/proposals/ProposalsListPage', () => ({
  ProposalsListPage: () => null,
}));
vi.mock('@/components/groups/proposals/ProposalDetail', () => ({
  ProposalDetail: () => null,
}));

import { GET, POST } from '@/app/api/groups/[slug]/proposals/route';
import ProposalsPage from '@/app/groups/[slug]/proposals/page';
import ProposalPage from '@/app/groups/[slug]/proposals/[id]/page';

const GROUP_ID = '0b8f9a52-3f2e-4c4f-9d1a-7d6c1b2a3e4f';
const SLUG = 'bitcoin-education-foundation';
const FOUNDER = { id: '5a1c2d3e-4f50-4617-8293-a4b5c6d7e8f9' };

const GROUP = {
  id: GROUP_ID,
  slug: SLUG,
  name: 'Bitcoin Education Foundation',
  is_public: true,
  governance_preset: 'democratic',
  voting_threshold: 50,
};

type Row = Record<string, unknown>;

/** A stand-in for the server client: every table answers with its rows. */
function fakeServerClient(user: { id: string } | null, tables: Record<string, Row[]>) {
  return {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table: string) {
      const rows = tables[table] ?? [];
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'or', 'in', 'order', 'range', 'not', 'is']) {
        builder[method] = () => builder;
      }
      builder.maybeSingle = async () => ({ data: rows[0] ?? null, error: null });
      builder.single = builder.maybeSingle;
      builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve({ data: rows, count: rows.length, error: null }).then(resolve, reject);
      return builder;
    },
  };
}

const signedOut = () => fakeServerClient(null, { groups: [GROUP], group_proposals: [] });
const signedInFounder = () =>
  fakeServerClient(FOUNDER, {
    groups: [GROUP],
    group_members: [{ group_id: GROUP_ID, role: 'founder', permission_overrides: null }],
    group_proposals: [],
  });

const routeContext = { params: Promise.resolve({ slug: SLUG }) };
const listUrl = `https://orangecat.ch/api/groups/${SLUG}/proposals?limit=50`;

describe('the proposals API reads the group with the server client', () => {
  it("answers a public group's proposals to a signed-out visitor", async () => {
    serverClient = signedOut();
    const res = await GET(new NextRequest(listUrl), routeContext);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ proposals: [], total: 0 });
  });

  it('answers them to a signed-in member too', async () => {
    serverClient = signedInFounder();
    const res = await GET(new NextRequest(listUrl), routeContext);
    expect(res.status).toBe(200);
  });

  it("lets a founder create a proposal instead of answering 'Group not found'", async () => {
    serverClient = signedInFounder();
    const req = new NextRequest(listUrl, {
      method: 'POST',
      body: JSON.stringify({ title: 'Fund the winter meetup' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req, routeContext);
    expect(res.status).toBe(201);
  });
});

describe('the proposals pages read the group with the server client', () => {
  it('render the list for a signed-out visitor instead of a 404', async () => {
    serverClient = signedOut();
    const element = (await ProposalsPage({ params: Promise.resolve({ slug: SLUG }) })) as {
      props: Record<string, unknown>;
    };
    expect(element.props).toMatchObject({
      groupId: GROUP_ID,
      groupName: GROUP.name,
      canCreateProposal: false,
    });
  });

  it('offer a founder "create proposal" on the list', async () => {
    serverClient = signedInFounder();
    const element = (await ProposalsPage({ params: Promise.resolve({ slug: SLUG }) })) as {
      props: Record<string, unknown>;
    };
    expect(element.props.canCreateProposal).toBe(true);
  });

  it('render a single proposal with the founder allowed to vote and activate', async () => {
    serverClient = signedInFounder();
    const element = (await ProposalPage({
      params: Promise.resolve({ slug: SLUG, id: 'p1' }),
    })) as { props: Record<string, unknown> };
    expect(element.props).toMatchObject({ groupId: GROUP_ID, canVote: true, canActivate: true });
  });

  it('still 404 a group that does not exist', async () => {
    serverClient = fakeServerClient(null, { groups: [] });
    await expect(ProposalsPage({ params: Promise.resolve({ slug: 'nope' }) })).rejects.toThrow(
      NotFound
    );
  });
});

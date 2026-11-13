/**
 * Who may read /post/<id> is the database's rule, applied with the reader's
 * own session: these pin that the page asks the RLS-protected
 * `timeline_events` TABLE (never `enriched_timeline_events`, a view that runs
 * with its owner's rights and ignores RLS), that a signed-out reader is let
 * through the middleware to ask, and that whatever the database withholds
 * stays withheld.
 */
import { DATABASE_TABLES } from '@/config/database-tables';
import { requiresSignIn } from '@/config/routes';

const { state } = vi.hoisted(() => ({
  state: {
    user: null as null | { id: string },
    /** What RLS lets this reader see, by id. */
    visibleRows: {} as Record<string, Record<string, unknown>>,
    tables: [] as string[],
  },
}));

function query(table: string) {
  state.tables.push(table);
  const filters: Record<string, unknown> = {};
  const q = {
    select: () => q,
    eq: (col: string, val: unknown) => {
      filters[col] = val;
      return q;
    },
    maybeSingle: async () => {
      if (table === DATABASE_TABLES.PROFILES) {
        return { data: { name: 'Ada', username: 'ada' }, error: null };
      }
      if (table !== DATABASE_TABLES.TIMELINE_EVENTS) {
        // Any other read would be a bypass: answer with a row so the test
        // fails loudly if the code ever goes there.
        return { data: { id: filters.id, visibility: 'private', actor_id: 'x' }, error: null };
      }
      return { data: state.visibleRows[String(filters.id)] ?? null, error: null };
    },
  };
  return q;
}

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => query(table),
  }),
}));

import { getPostForPage } from '@/services/timeline/get-post-preview.server';

const PUBLIC_ID = '11111111-1111-4111-8111-111111111111';
const FOLLOWERS_ID = '22222222-2222-4222-8222-222222222222';

const row = (id: string, visibility: string) => ({
  id,
  visibility,
  title: 'Title',
  description: 'Words',
  actor_id: 'author-1',
  event_timestamp: '2026-11-01T00:00:00Z',
});

beforeEach(() => {
  state.user = null;
  state.visibleRows = {};
  state.tables = [];
});

describe('the /post route', () => {
  it('does not send a signed-out reader to sign in before the page can decide', () => {
    expect(requiresSignIn('/post/abc')).toBe(false);
    // The routes that do need an account still do.
    expect(requiresSignIn('/timeline')).toBe(true);
    expect(requiresSignIn('/messages')).toBe(true);
  });
});

describe('getPostForPage', () => {
  it('reads a public post for a signed-out reader from the RLS-protected table', async () => {
    state.visibleRows[PUBLIC_ID] = row(PUBLIC_ID, 'public');
    const { post, viewerSignedIn } = await getPostForPage(PUBLIC_ID);
    expect(viewerSignedIn).toBe(false);
    expect(post).toMatchObject({
      id: PUBLIC_ID,
      visibility: 'public',
      text: 'Words',
      authorName: 'Ada',
    });
    expect(state.tables).toContain(DATABASE_TABLES.TIMELINE_EVENTS);
    expect(state.tables).not.toContain(DATABASE_TABLES.ENRICHED_TIMELINE_EVENTS);
  });

  it('returns nothing when the database withholds the post (followers-only, signed out)', async () => {
    // RLS hides a followers post from anon: no row comes back.
    const { post } = await getPostForPage(FOLLOWERS_ID);
    expect(post).toBeNull();
    expect(state.tables).not.toContain(DATABASE_TABLES.ENRICHED_TIMELINE_EVENTS);
  });

  it('returns a non-public post to a reader the database lets see it, still marked non-public', async () => {
    state.user = { id: 'follower-1' };
    state.visibleRows[FOLLOWERS_ID] = row(FOLLOWERS_ID, 'followers');
    const { post, viewerSignedIn } = await getPostForPage(FOLLOWERS_ID);
    expect(viewerSignedIn).toBe(true);
    expect(post?.visibility).toBe('followers');
  });

  it('does not query at all for something that is not a post id', async () => {
    const { post } = await getPostForPage('not-an-id');
    expect(post).toBeNull();
    expect(state.tables).toEqual([]);
  });
});

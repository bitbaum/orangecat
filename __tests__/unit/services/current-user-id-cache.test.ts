/**
 * Learning who is reading costs a network call, so do it once.
 *
 * `supabase.auth.getUser()` validates the token against `/auth/v1/user` — it is
 * not a local read. Enrichment calls it once per pass, and enrichment runs once
 * per node while a reply tree is built, so opening a thread fired one
 * round-trip per reply just to re-learn the same id. Production 2026-08-28:
 * eight `/auth/v1/user` calls to open one post.
 *
 * The concurrency case matters as much as the repeat case: enrichment is
 * deliberately parallel, so several callers arrive together and must collapse
 * onto one request rather than racing to make several.
 */

import { getCurrentUserId, __resetCurrentUserIdCache } from '@/services/supabase/auth/session';
// The timeline re-exports it rather than defining its own; both names must be
// the same function, or the cache would only cover half the callers.
import { getCurrentUserId as timelineGetCurrentUserId } from '@/services/timeline/processors/social-shared';

const getUser = vi.fn();
vi.mock('@/lib/supabase/browser', () => ({
  __esModule: true,
  default: {
    auth: {
      getUser: (...a: unknown[]) => getUser(...a),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

describe('getCurrentUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetCurrentUserIdCache();
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
  });

  it('asks the network once, however many times it is called', async () => {
    expect(await getCurrentUserId()).toBe('u1');
    expect(await getCurrentUserId()).toBe('u1');
    expect(await getCurrentUserId()).toBe('u1');

    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('collapses concurrent callers onto one request', async () => {
    const [a, b, c] = await Promise.all([
      getCurrentUserId(),
      getCurrentUserId(),
      getCurrentUserId(),
    ]);

    expect([a, b, c]).toEqual(['u1', 'u1', 'u1']);
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('does not cache a thrown failure as "signed out"', async () => {
    __resetCurrentUserIdCache();
    getUser.mockRejectedValueOnce(new Error('network blip'));

    expect(await getCurrentUserId()).toBeNull();

    // A blip must not outlive itself and render the whole app as signed-out
    // for the rest of the page.
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    expect(await getCurrentUserId()).toBe('u1');
  });

  it('does not cache a REPORTED failure as "signed out" either', async () => {
    // The auth layer catches its own errors and reports them in `error` rather
    // than throwing, so "could not ask" arrives looking almost exactly like
    // "nobody is signed in". Only the error field tells them apart.
    __resetCurrentUserIdCache();
    getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'fetch failed' },
    });

    expect(await getCurrentUserId()).toBeNull();

    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    expect(await getCurrentUserId()).toBe('u1');
  });

  it('is the SAME function the timeline uses, so one cache covers both', async () => {
    expect(timelineGetCurrentUserId).toBe(getCurrentUserId);

    await getCurrentUserId();
    await timelineGetCurrentUserId();

    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('caches a genuine signed-out answer', async () => {
    __resetCurrentUserIdCache();
    getUser.mockResolvedValue({ data: { user: null } });

    expect(await getCurrentUserId()).toBeNull();
    expect(await getCurrentUserId()).toBeNull();

    expect(getUser).toHaveBeenCalledTimes(1);
  });
});

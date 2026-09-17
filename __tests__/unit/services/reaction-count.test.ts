/**
 * The count a reaction reports back must survive the shape PostgREST sends.
 *
 * `like_timeline_event` and its three siblings are declared
 * `RETURNS TABLE(<name>_count integer)`, and a set-returning function comes
 * back as an ARRAY of rows: `[{ like_count: 1 }]`. The client indexed that
 * array as though it were the row, so the lookup was always `undefined` and the
 * `|| 0` fallback turned every successful like into a count of zero.
 *
 * It hid well. The filled heart comes from a boolean the client sets itself, so
 * liking something looked right while the number beside it stayed blank — and
 * for the eight months the RPC was also raising 42703, there was no successful
 * response to notice it in.
 *
 * Pinned against both shapes: the array PostgREST actually sends, and the bare
 * object it would send if one of these were ever rewritten to return a scalar.
 */

import { toggleLike } from '@/services/timeline/processors/reactions';

const rpc = vi.fn();
const from = vi.fn();

vi.mock('@/services/timeline/processors/social-shared', () => ({
  db: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (...args: unknown[]) => from(...args),
  },
  getCurrentUserId: async () => 'user-1',
}));

/** No existing reaction row, so toggling adds one and calls the add RPC. */
function noExistingReaction() {
  from.mockReturnValue({
    select: () => ({
      eq: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }),
    }),
  });
}

describe('reaction counts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    noExistingReaction();
  });

  it('reads the count out of the array PostgREST returns for RETURNS TABLE', async () => {
    rpc.mockResolvedValue({ data: [{ like_count: 7 }], error: null });

    // toMatchObject, not toEqual: the response also carries the OPPOSITE
    // reaction's state now, because a like retracts a dislike. This test is
    // about reading the count out of PostgREST's array shape, not about the
    // full result envelope.
    await expect(toggleLike('event-1', 'user-1')).resolves.toMatchObject({
      success: true,
      liked: true,
      likeCount: 7,
    });
  });

  it('also accepts a bare object, so a scalar rewrite cannot silently zero it', async () => {
    rpc.mockResolvedValue({ data: { like_count: 3 }, error: null });

    await expect(toggleLike('event-1', 'user-1')).resolves.toMatchObject({ likeCount: 3 });
  });

  it('reports zero when the response carries no count at all', async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    await expect(toggleLike('event-1', 'user-1')).resolves.toMatchObject({ likeCount: 0 });
  });
});

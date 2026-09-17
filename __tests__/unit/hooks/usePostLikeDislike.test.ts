// @vitest-environment jsdom
/**
 * Liking and disliking are mutually exclusive, and the UI has to say so.
 *
 * The RPCs delete the opposing row when you switch sides. The client did not
 * model that: `handleLike` only ever wrote `userLiked`/`likesCount`, so after
 * liking a post and then disliking it, BOTH buttons rendered as active and the
 * like count kept a number with no row behind it.
 *
 * Observed in production 2026-08-28 on orangecat.ch/timeline: like → dislike
 * left `aria-pressed="true"` on both, and `timeline_event_stats` held
 * `like_count: 1, dislike_count: 1` for an event with no like row at all.
 */

import { renderHook, act } from '@testing-library/react';
import { usePostLikeDislike } from '@/hooks/usePostLikeDislike';
import type { TimelineDisplayEvent } from '@/types/timeline';

const toggleLike = vi.fn();
const toggleDislike = vi.fn();
vi.mock('@/services/timeline', () => ({
  timelineService: {
    toggleLike: (...a: unknown[]) => toggleLike(...a),
    toggleDislike: (...a: unknown[]) => toggleDislike(...a),
  },
}));

function eventWith(overrides: Partial<TimelineDisplayEvent>): TimelineDisplayEvent {
  return {
    id: 'e1',
    userLiked: false,
    likesCount: 0,
    userDisliked: false,
    dislikesCount: 0,
    ...overrides,
  } as TimelineDisplayEvent;
}

describe('liking and disliking are exclusive', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears the like when you dislike a post you had liked', async () => {
    const onUpdate = vi.fn();
    toggleDislike.mockResolvedValue({
      success: true,
      disliked: true,
      dislikeCount: 1,
      liked: false,
      likeCount: 0,
    });

    const { result } = renderHook(() =>
      usePostLikeDislike({
        event: eventWith({ userLiked: true, likesCount: 1 }),
        onUpdate,
      })
    );

    await act(async () => {
      await result.current.handleDislike();
    });

    // Optimistic pass: the like goes immediately, not after the round trip.
    expect(onUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ userDisliked: true, userLiked: false, likesCount: 0 })
    );
    // Server pass: both totals come from the response.
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userDisliked: true,
        dislikesCount: 1,
        userLiked: false,
        likesCount: 0,
      })
    );
  });

  it('clears the dislike when you like a post you had disliked', async () => {
    const onUpdate = vi.fn();
    toggleLike.mockResolvedValue({
      success: true,
      liked: true,
      likeCount: 1,
      disliked: false,
      dislikeCount: 0,
    });

    const { result } = renderHook(() =>
      usePostLikeDislike({
        event: eventWith({ userDisliked: true, dislikesCount: 1 }),
        onUpdate,
      })
    );

    await act(async () => {
      await result.current.handleLike();
    });

    expect(onUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ userLiked: true, userDisliked: false, dislikesCount: 0 })
    );
  });

  it('leaves the opposite alone when simply un-liking', async () => {
    const onUpdate = vi.fn();
    toggleLike.mockResolvedValue({ success: true, liked: false, likeCount: 0, dislikeCount: 0 });

    const { result } = renderHook(() =>
      usePostLikeDislike({ event: eventWith({ userLiked: true, likesCount: 1 }), onUpdate })
    );

    await act(async () => {
      await result.current.handleLike();
    });

    // Un-liking retracts nothing, so `disliked` is absent from the response and
    // must not be invented here.
    const optimistic = onUpdate.mock.calls[0][0];
    expect(optimistic).not.toHaveProperty('userDisliked');
  });

  it('restores both sides when the server refuses', async () => {
    const onUpdate = vi.fn();
    toggleDislike.mockResolvedValue({ success: false, disliked: false, dislikeCount: 0 });

    const { result } = renderHook(() =>
      usePostLikeDislike({
        event: eventWith({ userLiked: true, likesCount: 1 }),
        onUpdate,
      })
    );

    await act(async () => {
      await result.current.handleDislike();
    });

    // A failed switch must put the like back, not leave the post with neither.
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ userDisliked: false, userLiked: true, likesCount: 1 })
    );
  });
});

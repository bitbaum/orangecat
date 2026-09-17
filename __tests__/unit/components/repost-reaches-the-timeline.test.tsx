// @vitest-environment jsdom
/**
 * A quote repost has to reach the list it was made from.
 *
 * `usePostRepost` only hands the created post back if it was given somewhere to
 * put it: `if (result.event && onAddEvent)`. Nobody was giving it one —
 * usePostCardActions called `usePostInteractions({ event, onUpdate })` and
 * stopped there — so the repost was written to the database and then existed
 * nowhere on screen until a reload.
 *
 * Verified in production 2026-08-28: quote-reposting created event c09b9f0b
 * and the feed did not change.
 *
 * The bug was a missing ARGUMENT, not broken logic, which is why it survived: a
 * unit test of usePostRepost passes with or without it. So this asserts the
 * forward itself.
 */

import { renderHook } from '@testing-library/react';
import { usePostCardActions } from '@/components/timeline/usePostCardActions';
import type { TimelineDisplayEvent } from '@/types/timeline';

const usePostInteractions = vi.fn(() => ({
  isReposting: false,
  repostModalOpen: false,
  handleRepostClick: vi.fn(),
  handleRepostClose: vi.fn(),
  handleSimpleRepost: vi.fn(),
  handleQuoteRepost: vi.fn(),
}));

vi.mock('@/hooks/usePostInteractions', () => ({
  usePostInteractions: (args: unknown) => usePostInteractions(args as never),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/services/timeline', () => ({ timelineService: {} }));

const event = { id: 'e1', actor: { id: 'a1' } } as TimelineDisplayEvent;

describe('a quote repost reaches the timeline', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards onAddEvent, without which the new post is dropped', () => {
    const onAddEvent = vi.fn();

    renderHook(() =>
      usePostCardActions({
        event,
        user: { id: 'a1' } as never,
        profile: null,
        onUpdate: vi.fn(),
        onAddEvent,
      })
    );

    expect(usePostInteractions).toHaveBeenCalledWith(expect.objectContaining({ onAddEvent }));
  });

  it('still works for callers that do not want the new post', () => {
    renderHook(() =>
      usePostCardActions({
        event,
        user: { id: 'a1' } as never,
        profile: null,
        onUpdate: vi.fn(),
      })
    );

    // Optional by design — a thread view has its own way of inserting replies.
    expect(usePostInteractions).toHaveBeenCalledWith(
      expect.objectContaining({ onAddEvent: undefined })
    );
  });
});

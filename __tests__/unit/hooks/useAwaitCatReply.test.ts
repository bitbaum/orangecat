// @vitest-environment jsdom
/**
 * Tagging the Cat should behave like tagging @grok: you ask in the thread and
 * the answer turns up in the thread.
 *
 * The threading was already right — the Cat writes its answer as a child of the
 * post that tagged it. What was missing is that the answer never ARRIVED. The
 * thread refetches once when your reply is created, and the Cat takes 10–17
 * seconds to think (production 2026-08-28: 07:48:46 → 07:49:03, and 07:23:52 →
 * 07:24:02). By then the refetch is over, and there is no realtime subscription
 * on timeline events, so the reply sat in the database until a manual reload.
 *
 * Two things have to hold: it waits when the Cat was tagged, and it does NOT
 * wait when it was not — a phantom wait would leave "Cat is answering" on a
 * thread forever.
 */

import { renderHook, act } from '@testing-library/react';
import { useAwaitCatReply } from '@/hooks/useAwaitCatReply';
import type { TimelineDisplayEvent } from '@/types/timeline';

const getReplies = vi.fn();
vi.mock('@/services/timeline', () => ({
  timelineService: { getReplies: (...a: unknown[]) => getReplies(...a) },
}));

const reply = (description: string): TimelineDisplayEvent =>
  ({ id: 'r1', description }) as TimelineDisplayEvent;

describe('useAwaitCatReply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    getReplies.mockResolvedValue({ replies: [] });
  });
  afterEach(() => vi.useRealTimers());

  it('waits after a reply that tags the Cat', () => {
    const { result } = renderHook(() => useAwaitCatReply({ onArrived: vi.fn() }));

    act(() => result.current.watchIfTagged(reply('@cat what is this?')));

    expect(result.current.awaitingParentId).toBe('r1');
  });

  it('does not wait for a reply that never mentioned the Cat', () => {
    const { result } = renderHook(() => useAwaitCatReply({ onArrived: vi.fn() }));

    act(() => result.current.watchIfTagged(reply('just talking to people here')));

    expect(result.current.awaitingParentId).toBeNull();
  });

  it('is not fooled by a handle that merely starts with cat', () => {
    const { result } = renderHook(() => useAwaitCatReply({ onArrived: vi.fn() }));

    act(() => result.current.watchIfTagged(reply('@catalogue is a different account')));

    expect(result.current.awaitingParentId).toBeNull();
  });

  it('hands over the answer and stops waiting once it arrives', async () => {
    const onArrived = vi.fn();
    const catReply = { id: 'c1', metadata: { is_cat_reply: true } };
    getReplies.mockResolvedValue({ replies: [catReply] });

    const { result } = renderHook(() => useAwaitCatReply({ onArrived }));

    await act(async () => {
      result.current.watchIfTagged(reply('@cat explain'));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onArrived).toHaveBeenCalledWith('r1', catReply);
    expect(result.current.awaitingParentId).toBeNull();
  });

  it('ignores replies from anyone else while waiting', async () => {
    const onArrived = vi.fn();
    // Somebody else answering first must not end the wait — the Cat's answer is
    // what was asked for.
    getReplies.mockResolvedValue({ replies: [{ id: 'human', metadata: {} }] });

    const { result } = renderHook(() => useAwaitCatReply({ onArrived }));

    await act(async () => {
      result.current.watchIfTagged(reply('@cat explain'));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onArrived).not.toHaveBeenCalled();
    expect(result.current.awaitingParentId).toBe('r1');
  });

  it('gives up rather than waiting forever', async () => {
    const { result } = renderHook(() => useAwaitCatReply({ onArrived: vi.fn() }));

    await act(async () => {
      result.current.watchIfTagged(reply('@cat explain'));
    });
    expect(result.current.awaitingParentId).toBe('r1');

    // The Cat answers even when it cannot think — a fallback reply is still a
    // reply — so silence past the window means something upstream is wrong, and
    // a spinner that never resolves is worse than none.
    await act(async () => {
      vi.advanceTimersByTime(65_000);
      await Promise.resolve();
    });

    expect(result.current.awaitingParentId).toBeNull();
  });
});

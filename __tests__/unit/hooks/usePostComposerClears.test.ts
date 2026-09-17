// @vitest-environment jsdom
/**
 * The composer must be empty once the post exists.
 *
 * It was not. A successful post called `clearDraft()` — which discards the
 * SAVED draft — while `clearFormState()`, the one that owns `content`, was
 * reachable only from the offline-queue path and from `reset()`. So the text
 * you had just posted stayed in the box, and pressing post again hit the
 * server's duplicate guard ("You just posted this"), which reads as the button
 * being broken rather than as having already worked.
 *
 * Verified in production before the fix: the post was created at 12:18:10 and
 * the composer still held "ctrl enter round two" afterwards. It affected the
 * button exactly as much as the keyboard shortcut.
 *
 * This pins the two halves that have to hold together: the draft is discarded
 * AND the form is emptied, and the caller's own onSuccess still runs.
 */

import { renderHook, act } from '@testing-library/react';
import { usePostComposer } from '@/hooks/usePostComposerNew';

const submitPost = vi.fn();
const clearDraft = vi.fn();

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/usePostDraft', () => ({
  usePostDraft: () => ({ clearDraft: (...a: unknown[]) => clearDraft(...a) }),
}));
vi.mock('@/services/timeline/utils/post-composer', () => ({
  submitPost: (...a: unknown[]) => submitPost(...a),
  formatPostError: (e: Error) => e.message,
  queueOfflinePost: vi.fn(),
  fetchUserProjects: async () => [],
}));

describe('the composer after a successful post', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submitPost.mockResolvedValue({ success: true, event: { id: 'e1' } });
  });

  it('empties the box, so posting again is not blocked as a duplicate', async () => {
    const { result } = renderHook(() => usePostComposer());

    act(() => result.current.setContent('something worth saying'));
    expect(result.current.content).toBe('something worth saying');

    await act(async () => {
      await result.current.handlePost();
    });

    expect(result.current.content).toBe('');
    // The saved draft is discarded too — both, not one or the other.
    expect(clearDraft).toHaveBeenCalled();
  });

  it('still calls the caller onSuccess', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => usePostComposer({ onSuccess }));

    act(() => result.current.setContent('hello'));
    await act(async () => {
      await result.current.handlePost();
    });

    expect(onSuccess).toHaveBeenCalled();
  });

  it('keeps the text when the post fails, so nothing is lost', async () => {
    submitPost.mockResolvedValue({ success: false, error: 'nope' });
    const { result } = renderHook(() => usePostComposer());

    act(() => result.current.setContent('do not lose me'));
    await act(async () => {
      await result.current.handlePost();
    });

    expect(result.current.content).toBe('do not lose me');
  });
});

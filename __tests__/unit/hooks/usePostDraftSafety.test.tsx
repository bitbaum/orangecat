// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useMemo, useState } from 'react';
import { usePostDraft } from '@/hooks/usePostDraft';
import {
  legacyPostDraftKey,
  postDraftKey,
  readPostDraft,
} from '@/services/timeline/post-draft-storage';
import type { TimelineVisibility } from '@/types/timeline';

const storageSet = vi.mocked(localStorage.setItem).getMockImplementation()!;
const storageRemove = vi.mocked(localStorage.removeItem).getMockImplementation()!;
let serial = 0;
const own = () => `draft-safety-${++serial}`;
const saved = (content: string, extra = {}) => ({
  version: 2,
  content,
  visibility: 'public',
  selectedProjects: [],
  timestamp: Date.now(),
  ...extra,
});
function useHarness({
  ownerId,
  parentEventId,
  enabled = true,
  initial = '',
}: {
  ownerId?: string;
  parentEventId?: string;
  enabled?: boolean;
  initial?: string;
}) {
  const [content, setContent] = useState(initial);
  const [visibility, setVisibility] = useState<TimelineVisibility>('public');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const setters = useMemo(() => ({ setContent, setVisibility, setSelectedProjects }), []);
  const draft = usePostDraft(
    {
      ownerId,
      subjectType: 'profile',
      parentEventId,
      enableDrafts: enabled,
      debounceMs: 300,
      defaultVisibility: 'public',
    },
    { content, visibility, selectedProjects },
    setters
  );
  return { content, setContent, visibility, selectedProjects, draft };
}

describe('post draft safety', () => {
  beforeEach(() => {
    vi.mocked(localStorage.setItem).mockImplementation(storageSet);
    vi.mocked(localStorage.removeItem).mockImplementation(storageRemove);
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.mocked(localStorage.setItem).mockImplementation(storageSet);
    vi.mocked(localStorage.removeItem).mockImplementation(storageRemove);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it('flushes the latest words immediately on unmount and pagehide', () => {
    const ownerId = own();
    const { result, unmount } = renderHook(() => useHarness({ ownerId }));
    act(() => result.current.setContent('latest unmount words'));
    unmount();
    expect(readPostDraft(postDraftKey(ownerId, 'profile'))).toMatchObject({
      kind: 'ready',
      draft: { content: 'latest unmount words' },
    });
    const next = renderHook(() => useHarness({ ownerId }));
    act(() => {
      next.result.current.setContent('pagehide words');
    });
    act(() => window.dispatchEvent(new Event('pagehide')));
    expect(readPostDraft(postDraftKey(ownerId, 'profile'))).toMatchObject({
      kind: 'ready',
      draft: { content: 'pagehide words' },
    });
  });
  it('persists clearing saved text instead of resurrecting it', () => {
    const ownerId = own();
    const key = postDraftKey(ownerId, 'profile');
    localStorage.setItem(key, JSON.stringify(saved('old words')));
    const { result, unmount } = renderHook(() => useHarness({ ownerId }));
    expect(result.current.content).toBe('old words');
    act(() => result.current.setContent(''));
    unmount();
    expect(readPostDraft(key)).toMatchObject({ kind: 'ready', draft: { content: '' } });
  });
  it('keeps account and reply contexts separate during an account change', () => {
    const first = own(),
      second = own();
    const hook = renderHook(({ ownerId }) => useHarness({ ownerId }), {
      initialProps: { ownerId: first },
    });
    act(() => hook.result.current.setContent('first account words'));
    hook.rerender({ ownerId: second });
    expect(hook.result.current.content).toBe('');
    expect(readPostDraft(postDraftKey(first, 'profile'))).toMatchObject({
      kind: 'ready',
      draft: { content: 'first account words' },
    });
    act(() => hook.result.current.setContent('second account words'));
    hook.unmount();
    const reply = renderHook(() => useHarness({ ownerId: first, parentEventId: 'reply-context' }));
    expect(reply.result.current.content).toBe('');
    expect(readPostDraft(postDraftKey(second, 'profile'))).toMatchObject({
      kind: 'ready',
      draft: { content: 'second account words' },
    });
  });
  it('does not expire older owned writing', () => {
    const ownerId = own();
    localStorage.setItem(
      postDraftKey(ownerId, 'profile'),
      JSON.stringify(saved('older writing', { timestamp: Date.now() - 3 * 86400000 }))
    );
    const hook = renderHook(() => useHarness({ ownerId }));
    expect(hook.result.current.content).toBe('older writing');
  });
  it('does not reveal legacy text until recovery, then keeps both pieces as Only me', () => {
    const ownerId = own(),
      oldKey = legacyPostDraftKey('profile');
    localStorage.setItem(oldKey, JSON.stringify(saved('older unowned words')));
    const hook = renderHook(() => useHarness({ ownerId }));
    expect(hook.result.current.content).toBe('');
    expect(hook.result.current.draft.legacyAvailable).toBe(true);
    act(() => hook.result.current.setContent('current words'));
    act(() => {
      expect(hook.result.current.draft.recoverLegacyDraft()).toBe(true);
    });
    expect(hook.result.current.content).toBe('current words\n\nolder unowned words');
    expect(hook.result.current.visibility).toBe('private');
    expect(hook.result.current.selectedProjects).toEqual([]);
    expect(localStorage.getItem(oldKey)).toBeNull();
  });
  it('retains both originals when recovery cannot write', () => {
    const ownerId = own(),
      oldKey = legacyPostDraftKey('profile');
    const raw = JSON.stringify(saved('older words'));
    localStorage.setItem(oldKey, raw);
    const hook = renderHook(() => useHarness({ ownerId }));
    act(() => hook.result.current.setContent('current words'));
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    act(() => {
      expect(hook.result.current.draft.recoverLegacyDraft()).toBe(false);
    });
    expect(hook.result.current.content).toBe('current words');
    expect(localStorage.getItem(oldKey)).toBe(raw);
  });
  it('does not append twice when removing a copied legacy source fails', () => {
    const ownerId = own(),
      oldKey = legacyPostDraftKey('profile');
    localStorage.setItem(oldKey, JSON.stringify(saved('older words')));
    const hook = renderHook(() => useHarness({ ownerId }));
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    act(() => {
      expect(hook.result.current.draft.recoverLegacyDraft()).toBe(true);
    });
    act(() => {
      expect(hook.result.current.draft.recoverLegacyDraft()).toBe(true);
    });
    expect(hook.result.current.content).toBe('older words');
    hook.unmount();
    const restored = renderHook(() => useHarness({ ownerId }));
    expect(restored.result.current.content).toBe('older words');
    expect(restored.result.current.draft.legacyAvailable).toBe(false);
  });
  it('reports a failed save, retains its tab copy and retries when storage returns', () => {
    const ownerId = own();
    const key = postDraftKey(ownerId, 'profile');
    const hook = renderHook(() => useHarness({ ownerId }));
    act(() => hook.result.current.setContent('keep these words'));
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    act(() => {
      expect(hook.result.current.draft.flushDraft()).toBe(false);
    });
    expect(hook.result.current.draft.error).toContain('could not save');
    hook.unmount();
    spy.mockRestore();
    const restored = renderHook(() => useHarness({ ownerId }));
    expect(restored.result.current.content).toBe('keep these words');
    act(() => {
      expect(restored.result.current.draft.flushDraft()).toBe(true);
    });
    expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({ content: 'keep these words' });
  });
  it('does not restore a successfully cleared draft after unmount', () => {
    const ownerId = own();
    const hook = renderHook(() => useHarness({ ownerId }));
    act(() => hook.result.current.setContent('already posted words'));
    act(() => {
      expect(hook.result.current.draft.clearDraft()).toBe(true);
    });
    hook.unmount();
    expect(readPostDraft(postDraftKey(ownerId, 'profile'))).toEqual({ kind: 'missing' });
  });
  it('backs up an unreadable owned store before replacing it with current writing', () => {
    const ownerId = own(),
      key = postDraftKey(ownerId, 'profile');
    localStorage.setItem(key, '{unreadable original');
    const hook = renderHook(() => useHarness({ ownerId }));
    act(() => hook.result.current.setContent('new writing'));
    act(() => {
      expect(hook.result.current.draft.flushDraft()).toBe(true);
    });
    const backup = Array.from({ length: localStorage.length }, (_, index) =>
      localStorage.key(index)!
    ).find(item => item.startsWith(key + ':unreadable:'))!;
    expect(localStorage.getItem(backup)).toBe('{unreadable original');
  });
  it('leaves incoming share text intact when persistence is disabled', () => {
    const hook = renderHook(() =>
      useHarness({ ownerId: own(), enabled: false, initial: 'shared link text' })
    );
    expect(hook.result.current.content).toBe('shared link text');
    act(() => {
      expect(hook.result.current.draft.flushDraft()).toBe(true);
    });
    expect(localStorage.length).toBe(0);
  });
});

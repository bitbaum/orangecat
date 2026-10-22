// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { useLocalArticleDrafts } from '@/app/(public)/articles/new/useLocalArticleDrafts';
import { listLocalDrafts, saveLocalDraft } from '@/services/articles/local-drafts';

function useDraft() {
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const draft = useLocalArticleDrafts(
    false,
    { title, excerpt, coverImage, body, visibility },
    { setTitle, setExcerpt, setCoverImage, setBody, setVisibility }
  );
  return { ...draft, title, setTitle };
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('flushes the latest edit on navigation before the autosave delay', () => {
  const { result, unmount } = renderHook(useDraft);
  act(() => result.current.setTitle('Latest change'));
  expect(listLocalDrafts()).toEqual([]);
  unmount();
  expect(listLocalDrafts()[0].title).toBe('Latest change');
});

it('flushes on pagehide, before a reload can lose the edit', () => {
  const { result } = renderHook(useDraft);
  act(() => result.current.setTitle('Before reload'));
  act(() => window.dispatchEvent(new Event('pagehide')));
  expect(listLocalDrafts()[0].title).toBe('Before reload');
});

it('does not resurrect a published or discarded draft on unmount', () => {
  const { result, unmount } = renderHook(useDraft);
  act(() => result.current.setTitle('Finished'));
  act(() => vi.advanceTimersByTime(600));
  act(() => result.current.completeDraft());
  unmount();
  expect(listLocalDrafts()).toEqual([]);
});

it('keeps a failed write pending so it can be retried', () => {
  const { result } = renderHook(useDraft);
  vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
    throw new Error('Quota exceeded');
  });
  act(() => result.current.setTitle('Keep my writing'));
  act(() => vi.advanceTimersByTime(600));
  expect(result.current.saveStatus).toBe('error');
  act(() => result.current.flushDraftNow());
  expect(listLocalDrafts()[0].title).toBe('Keep my writing');
  expect(result.current.saveStatus).toBe('saved');
});

it('does not restore a discarded draft after leaving immediately', () => {
  const { result, unmount } = renderHook(useDraft);
  act(() => result.current.setTitle('Discard me'));
  act(() => result.current.discardCurrentDraft());
  unmount();
  expect(listLocalDrafts()).toEqual([]);
});

it('keeps current writing when switching drafts cannot save it, then allows retry', () => {
  const other = {
    id: 'other-draft',
    title: 'Other writing',
    excerpt: '',
    coverImage: '',
    body: 'Previously saved',
    visibility: 'private' as const,
    updatedAt: 1,
  };
  saveLocalDraft(other);
  const { result } = renderHook(useDraft);
  act(() => result.current.discardCurrentDraft());
  saveLocalDraft(other);
  act(() => result.current.setTitle('Unsaved current writing'));
  const currentId = result.current.draftId;
  vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
    throw new Error('Quota exceeded');
  });
  act(() => {
    expect(result.current.loadDraft(other)).toBe(false);
  });
  expect(result.current.title).toBe('Unsaved current writing');
  expect(result.current.draftId).toBe(currentId);
  expect(result.current.saveStatus).toBe('error');
  act(() => {
    expect(result.current.loadDraft(other)).toBe(true);
  });
  expect(result.current.title).toBe('Other writing');
  expect(listLocalDrafts().find(d => d.id === currentId)?.title).toBe('Unsaved current writing');
});

it('persists clearing a started draft without restoring its previous text', () => {
  const { result, unmount } = renderHook(useDraft);
  act(() => result.current.setTitle('Remove this text'));
  act(() => vi.advanceTimersByTime(600));
  act(() => result.current.setTitle(''));
  unmount();
  expect(listLocalDrafts()[0].title).toBe('');
  const restored = renderHook(useDraft);
  expect(restored.result.current.title).toBe('');
});

it('does not create an empty draft when opening and leaving a fresh composer', () => {
  const { unmount } = renderHook(useDraft);
  act(() => vi.advanceTimersByTime(600));
  unmount();
  expect(listLocalDrafts()).toEqual([]);
});

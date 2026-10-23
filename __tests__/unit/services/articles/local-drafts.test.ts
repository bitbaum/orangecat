// @vitest-environment jsdom
import {
  deleteLocalDraft,
  listLocalDrafts,
  MAX_LOCAL_DRAFTS,
  newDraftId,
  saveLocalDraft,
  hasOlderDeviceDrafts,
  recoverOlderDeviceDrafts,
  type LocalArticleDraft,
} from '@/services/articles/local-drafts';
const makeDraft = (overrides: Partial<LocalArticleDraft> = {}): LocalArticleDraft => ({
  id: newDraftId(),
  title: 'Title',
  excerpt: '',
  coverImage: '',
  body: 'Body',
  visibility: 'private',
  updatedAt: Date.now(),
  ...overrides,
});
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it('isolates account reads, updates and deletions even when draft IDs match', () => {
  const a = makeDraft({ id: 'same', title: 'Account A' });
  const b = makeDraft({ id: 'same', title: 'Account B' });
  expect(saveLocalDraft('a', a)).toBe(true);
  expect(listLocalDrafts('b')).toEqual([]);
  expect(saveLocalDraft('b', b)).toBe(true);
  expect(deleteLocalDraft('b', b.id)).toBe(true);
  expect(listLocalDrafts('a')).toEqual([a]);
});
it('upserts and orders by last edit', () => {
  const a = makeDraft({ updatedAt: 1 });
  const b = makeDraft({ updatedAt: 2 });
  saveLocalDraft('a', a);
  saveLocalDraft('a', b);
  saveLocalDraft('a', { ...a, title: 'Edited', updatedAt: 3 });
  expect(listLocalDrafts('a').map(d => d.title)).toEqual(['Edited', 'Title']);
});
it('rejects a new draft at capacity without evicting older writing, but still saves edits', () => {
  for (let i = 0; i < MAX_LOCAL_DRAFTS; i++) {
    expect(saveLocalDraft('a', makeDraft({ id: `${i}`, updatedAt: i }))).toBe(true);
  }
  const before = listLocalDrafts('a');
  expect(saveLocalDraft('a', makeDraft())).toBe(false);
  expect(listLocalDrafts('a')).toEqual(before);
  expect(saveLocalDraft('a', { ...before[0], body: 'Edited' })).toBe(true);
});
it('keeps unreadable storage intact rather than overwriting it', () => {
  localStorage.setItem('oc:drafts:articles:profile:a', 'broken-json');
  expect(listLocalDrafts('a')).toEqual([]);
  expect(saveLocalDraft('a', makeDraft())).toBe(false);
  expect(deleteLocalDraft('a', 'x')).toBe(false);
  expect(localStorage.getItem('oc:drafts:articles:profile:a')).toBe('broken-json');
});
it('does not automatically assign old device writing to the next account', () => {
  localStorage.setItem('oc:drafts:articles', JSON.stringify([makeDraft()]));
  localStorage.setItem('oc:draft:article', JSON.stringify({ title: 'Older', body: 'Writing' }));
  expect(hasOlderDeviceDrafts()).toBe(true);
  expect(listLocalDrafts('a')).toEqual([]);
  expect(listLocalDrafts('b')).toEqual([]);
  expect(recoverOlderDeviceDrafts('a')).toBe(true);
  expect(listLocalDrafts('a')).toHaveLength(2);
  expect(listLocalDrafts('b')).toEqual([]);
  expect(hasOlderDeviceDrafts()).toBe(false);
});
it('keeps every old source when recovery cannot save', () => {
  const raw = JSON.stringify([makeDraft()]);
  localStorage.setItem('oc:drafts:articles', raw);
  vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
    throw Error('Quota');
  });
  expect(recoverOlderDeviceDrafts('a')).toBe(false);
  expect(localStorage.getItem('oc:drafts:articles')).toBe(raw);
  expect(listLocalDrafts('a')).toEqual([]);
});
it('makes recovery retries idempotent when source removal fails', () => {
  localStorage.setItem('oc:drafts:articles', JSON.stringify([makeDraft()]));
  vi.mocked(localStorage.removeItem).mockImplementationOnce(() => {
    throw Error('Blocked');
  });
  expect(recoverOlderDeviceDrafts('a')).toBe(false);
  expect(recoverOlderDeviceDrafts('a')).toBe(true);
  expect(listLocalDrafts('a')).toHaveLength(1);
});
it('leaves unparseable old drafts untouched', () => {
  localStorage.setItem('oc:draft:article', 'broken');
  expect(recoverOlderDeviceDrafts('a')).toBe(false);
  expect(localStorage.getItem('oc:draft:article')).toBe('broken');
});
it('preserves recovered writing above the new-draft limit', () => {
  const drafts = Array.from({ length: MAX_LOCAL_DRAFTS + 2 }, () => makeDraft());
  localStorage.setItem('oc:drafts:articles', JSON.stringify(drafts));
  expect(recoverOlderDeviceDrafts('a')).toBe(true);
  expect(listLocalDrafts('a')).toHaveLength(drafts.length);
});

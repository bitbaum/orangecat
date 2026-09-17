// @vitest-environment jsdom
import {
  deleteLocalDraft,
  listLocalDrafts,
  MAX_LOCAL_DRAFTS,
  newDraftId,
  saveLocalDraft,
  type LocalArticleDraft,
} from '@/services/articles/local-drafts';

const STORE_KEY = 'oc:drafts:articles';
const LEGACY_KEY = 'oc:draft:article';

function makeDraft(overrides: Partial<LocalArticleDraft> = {}): LocalArticleDraft {
  return {
    id: newDraftId(),
    title: 'Title',
    excerpt: '',
    coverImage: '',
    body: 'Body',
    visibility: 'public',
    updatedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('local article drafts', () => {
  it('round-trips a draft through save and list', () => {
    const draft = makeDraft({ title: 'My draft' });
    saveLocalDraft(draft);
    expect(listLocalDrafts()).toEqual([draft]);
  });

  it('lists drafts most recently touched first', () => {
    const old = makeDraft({ title: 'old', updatedAt: 1000 });
    const fresh = makeDraft({ title: 'fresh', updatedAt: 2000 });
    saveLocalDraft(old);
    saveLocalDraft(fresh);
    expect(listLocalDrafts().map(d => d.title)).toEqual(['fresh', 'old']);
  });

  it('upserts by id instead of duplicating', () => {
    const draft = makeDraft({ title: 'v1' });
    saveLocalDraft(draft);
    saveLocalDraft({ ...draft, title: 'v2', updatedAt: draft.updatedAt + 1 });
    const drafts = listLocalDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].title).toBe('v2');
  });

  it('deletes only the targeted draft', () => {
    const keep = makeDraft({ title: 'keep' });
    const drop = makeDraft({ title: 'drop' });
    saveLocalDraft(keep);
    saveLocalDraft(drop);
    deleteLocalDraft(drop.id);
    expect(listLocalDrafts().map(d => d.title)).toEqual(['keep']);
  });

  it('trims the store to MAX_LOCAL_DRAFTS, dropping the oldest', () => {
    for (let i = 0; i < MAX_LOCAL_DRAFTS + 3; i++) {
      saveLocalDraft(makeDraft({ title: `d${i}`, updatedAt: i }));
    }
    const drafts = listLocalDrafts();
    expect(drafts).toHaveLength(MAX_LOCAL_DRAFTS);
    // The oldest three (d0..d2) were dropped; the newest survives.
    expect(drafts[0].title).toBe(`d${MAX_LOCAL_DRAFTS + 2}`);
    expect(drafts.some(d => d.title === 'd0')).toBe(false);
  });

  it('migrates the legacy single-slot draft and removes the old key', () => {
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({
        title: 'Legacy',
        excerpt: '',
        coverImage: '',
        body: 'old body',
        visibility: 'followers',
      })
    );
    const drafts = listLocalDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ title: 'Legacy', body: 'old body', visibility: 'followers' });
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('ignores an empty legacy slot without creating a draft', () => {
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({ title: '', excerpt: '', coverImage: '', body: '', visibility: 'public' })
    );
    expect(listLocalDrafts()).toEqual([]);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('survives a corrupt store by treating it as empty', () => {
    localStorage.setItem(STORE_KEY, 'not-json{');
    expect(listLocalDrafts()).toEqual([]);
    const draft = makeDraft();
    saveLocalDraft(draft);
    expect(listLocalDrafts()).toEqual([draft]);
  });

  it('filters malformed entries out of the store', () => {
    const good = makeDraft({ title: 'good' });
    localStorage.setItem(STORE_KEY, JSON.stringify([good, { nonsense: true }, null]));
    expect(listLocalDrafts()).toEqual([good]);
  });

  it('generates unique draft ids', () => {
    expect(newDraftId()).not.toBe(newDraftId());
  });
});

/**
 * Client-side article draft store (localStorage). Multiple drafts live under one
 * key so starting a new article never clobbers an in-progress one. The legacy
 * single-slot key (`oc:draft:article`) is migrated into the store on first read.
 */

import type { TimelineVisibility } from '@/types/timeline';

export interface LocalArticleDraft {
  id: string;
  title: string;
  excerpt: string;
  coverImage: string;
  body: string;
  visibility: TimelineVisibility;
  /** Epoch ms of the last autosave — drives "most recent first" ordering. */
  updatedAt: number;
}

const STORE_KEY = 'oc:drafts:articles';
const LEGACY_KEY = 'oc:draft:article';

/** Oldest drafts are dropped beyond this — localStorage is a ~5MB budget. */
export const MAX_LOCAL_DRAFTS = 20;

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function readStore(): LocalArticleDraft[] {
  if (!hasStorage()) {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (d): d is LocalArticleDraft =>
        !!d &&
        typeof d === 'object' &&
        typeof (d as LocalArticleDraft).id === 'string' &&
        typeof (d as LocalArticleDraft).body === 'string'
    );
  } catch {
    return [];
  }
}

function writeStore(drafts: LocalArticleDraft[]): boolean {
  if (!hasStorage()) {
    return false;
  }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
}

/** Import the pre-multi-draft single slot, then remove it. */
function migrateLegacyDraft(): void {
  if (!hasStorage()) {
    return;
  }
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) {
      return;
    }
    const d = JSON.parse(raw) as Partial<LocalArticleDraft>;
    if (d.title || d.body) {
      const saved = saveLocalDraft({
        id: newDraftId(),
        title: d.title ?? '',
        excerpt: d.excerpt ?? '',
        coverImage: d.coverImage ?? '',
        body: d.body ?? '',
        visibility: d.visibility ?? 'public',
        updatedAt: Date.now(),
      });
      if (!saved) {
        return;
      }
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* corrupt legacy draft — leave it untouched rather than destroy it */
  }
}

export function newDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** All drafts, most recently touched first. Runs the legacy migration. */
export function listLocalDrafts(): LocalArticleDraft[] {
  migrateLegacyDraft();
  return readStore().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Upsert by id; trims the store to MAX_LOCAL_DRAFTS (oldest dropped). */
export function saveLocalDraft(draft: LocalArticleDraft): boolean {
  const rest = readStore().filter(d => d.id !== draft.id);
  const next = [draft, ...rest]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_LOCAL_DRAFTS);
  return writeStore(next);
}

export function deleteLocalDraft(id: string): void {
  writeStore(readStore().filter(d => d.id !== id));
}

/** Device drafts are scoped to the signed-in profile. Older unowned drafts require explicit recovery. */
import type { TimelineVisibility } from '@/types/timeline';

export interface LocalArticleDraft {
  id: string;
  title: string;
  excerpt: string;
  coverImage: string;
  body: string;
  visibility: TimelineVisibility;
  updatedAt: number;
}

const OLD_KEYS = ['oc:drafts:articles', 'oc:draft:article'] as const;
export const MAX_LOCAL_DRAFTS = 20;
const storeKey = (ownerId: string) => `oc:drafts:articles:profile:${ownerId}`;

function read(ownerId: string): unknown[] | null {
  try {
    if (!ownerId) {
      return null;
    }
    const raw = localStorage.getItem(storeKey(ownerId));
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isDraft(value: unknown): value is LocalArticleDraft {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const d = value as Partial<LocalArticleDraft>;
  return (
    ['id', 'title', 'excerpt', 'coverImage', 'body'].every(
      k => typeof d[k as keyof LocalArticleDraft] === 'string'
    ) &&
    typeof d.updatedAt === 'number' &&
    Number.isFinite(d.updatedAt) &&
    ['public', 'followers', 'private'].includes(d.visibility ?? '')
  );
}

function write(ownerId: string, drafts: unknown[]): boolean {
  try {
    if (!ownerId) {
      return false;
    }
    localStorage.setItem(storeKey(ownerId), JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
}

export function newDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function listLocalDrafts(ownerId: string): LocalArticleDraft[] {
  return (read(ownerId) ?? []).filter(isDraft).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Never overwrite an unreadable store or evict another piece of writing. */
export function saveLocalDraft(ownerId: string, draft: LocalArticleDraft): boolean {
  const stored = read(ownerId);
  if (!stored || !isDraft(draft)) {
    return false;
  }
  const replacing = stored.some(d => isDraft(d) && d.id === draft.id);
  if (!replacing && stored.length >= MAX_LOCAL_DRAFTS) {
    return false;
  }
  return write(ownerId, [draft, ...stored.filter(d => !isDraft(d) || d.id !== draft.id)]);
}

export function deleteLocalDraft(ownerId: string, id: string): boolean {
  const stored = read(ownerId);
  return (
    !!stored &&
    write(
      ownerId,
      stored.filter(d => !isDraft(d) || d.id !== id)
    )
  );
}

export function hasOlderDeviceDrafts(): boolean {
  try {
    return OLD_KEYS.some(key => localStorage.getItem(key) !== null);
  } catch {
    return false;
  }
}

/** Called only after the user identifies unowned device drafts as theirs. Copy before removing sources. */
export function recoverOlderDeviceDrafts(ownerId: string): boolean {
  try {
    const stored = read(ownerId);
    if (!stored) {
      return false;
    }
    const recovered: LocalArticleDraft[] = [];
    const sources: string[] = [];
    for (const key of OLD_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        continue;
      }
      const parsed: unknown = JSON.parse(raw);
      const values = key === OLD_KEYS[0] ? parsed : [parsed];
      if (!Array.isArray(values)) {
        return false;
      }
      for (const [index, value] of values.entries()) {
        if (!value || typeof value !== 'object') {
          return false;
        }
        const d = value as Partial<LocalArticleDraft>;
        if (typeof d.body !== 'string') {
          return false;
        }
        const normalized = {
          ...d,
          id: `recovered:${key}:${d.id ?? index}`,
          title: d.title ?? '',
          excerpt: d.excerpt ?? '',
          coverImage: d.coverImage ?? '',
          body: d.body ?? '',
          visibility: d.visibility ?? 'private',
          updatedAt: d.updatedAt ?? 0,
        };
        if (!isDraft(normalized)) {
          return false;
        }
        recovered.push(normalized);
      }
      sources.push(key);
    }
    const ids = new Set(stored.filter(isDraft).map(d => d.id));
    if (!write(ownerId, [...stored, ...recovered.filter(d => !ids.has(d.id))])) {
      return false;
    }
    for (const key of sources) {
      localStorage.removeItem(key);
    }
    return true;
  } catch {
    return false;
  }
}

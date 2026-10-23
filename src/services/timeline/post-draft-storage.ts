import type { TimelineVisibility } from '@/types/timeline';

export interface PostDraftValue {
  content: string;
  visibility: TimelineVisibility;
  selectedProjects: string[];
}
export interface SavedPostDraft extends PostDraftValue {
  version: 2;
  timestamp: number;
  recoveredLegacyRaw?: string;
}
export type PostDraftRead =
  | { kind: 'ready'; draft: SavedPostDraft; pending?: boolean }
  | { kind: 'missing' }
  | { kind: 'unreadable' };

// Failed browser writes remain available in this tab, scoped to the same account/context.
const pending = new Map<string, SavedPostDraft>();

export function postDraftKey(
  ownerId: string,
  subjectType: string,
  subjectId?: string,
  parentEventId?: string
) {
  return `oc:drafts:post:${encodeURIComponent(ownerId)}:${subjectType}:${encodeURIComponent(subjectId || 'general')}:${encodeURIComponent(parentEventId || 'new')}`;
}
export function legacyPostDraftKey(subjectType: string, subjectId?: string) {
  return `post-draft-${subjectType}-${subjectId || 'general'}`;
}
function isValue(value: unknown): value is PostDraftValue {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const draft = value as Partial<PostDraftValue>;
  return (
    typeof draft.content === 'string' &&
    ['public', 'followers', 'private'].includes(draft.visibility ?? '') &&
    Array.isArray(draft.selectedProjects) &&
    draft.selectedProjects.every(id => typeof id === 'string')
  );
}
function isSavedDraft(value: unknown): value is SavedPostDraft {
  if (!isValue(value)) {
    return false;
  }
  const draft = value as Partial<SavedPostDraft>;
  return (
    draft.version === 2 &&
    typeof draft.timestamp === 'number' &&
    Number.isFinite(draft.timestamp) &&
    (draft.recoveredLegacyRaw === undefined || typeof draft.recoveredLegacyRaw === 'string')
  );
}
export function readPostDraft(key: string): PostDraftRead {
  const held = pending.get(key);
  if (held) {
    return { kind: 'ready', draft: held, pending: true };
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return { kind: 'missing' };
    }
    const value: unknown = JSON.parse(raw);
    if (!isSavedDraft(value)) {
      return { kind: 'unreadable' };
    }
    return { kind: 'ready', draft: value as SavedPostDraft };
  } catch {
    return { kind: 'unreadable' };
  }
}

export function writePostDraft(
  key: string,
  draft: SavedPostDraft,
  retainOnFailure = true
): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      let readable = false;
      try {
        const parsed: unknown = JSON.parse(raw);
        readable = isSavedDraft(parsed);
      } catch {
        /* Preserve the raw bytes before replacing an unreadable owned store. */
      }
      if (!readable) {
        localStorage.setItem(`${key}:unreadable:${Date.now()}`, raw);
      }
    }
    localStorage.setItem(key, JSON.stringify(draft));
    pending.delete(key);
    return true;
  } catch {
    if (retainOnFailure) {
      pending.set(key, draft);
    }
    return false;
  }
}
export function deletePostDraft(key: string): boolean {
  pending.delete(key);
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    pending.set(key, {
      version: 2,
      content: '',
      visibility: 'private',
      selectedProjects: [],
      timestamp: Date.now(),
    });
    return false;
  }
}

/** Older device-wide writing is never exposed until the person claims it. */
export function readLegacyPostDraft(key: string): { raw: string; value: PostDraftValue } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const value: unknown = JSON.parse(raw);
    if (!isValue(value)) {
      return null;
    }
    return { raw, value };
  } catch {
    return null;
  }
}
export function removeLegacyPostDraft(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

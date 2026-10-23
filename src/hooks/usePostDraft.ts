import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TimelineVisibility } from '@/types/timeline';
import {
  deletePostDraft,
  legacyPostDraftKey,
  postDraftKey,
  readLegacyPostDraft,
  readPostDraft,
  removeLegacyPostDraft,
  writePostDraft,
  type PostDraftValue,
  type SavedPostDraft,
} from '@/services/timeline/post-draft-storage';

interface UsePostDraftOptions {
  ownerId?: string;
  subjectType: string;
  subjectId?: string;
  parentEventId?: string;
  enableDrafts: boolean;
  debounceMs: number;
  defaultVisibility: TimelineVisibility;
}
interface DraftSetters {
  setContent: (content: string) => void;
  setVisibility: (visibility: TimelineVisibility) => void;
  setSelectedProjects: (projects: string[]) => void;
}
export interface PostDraftController {
  saveDraft: (content: string) => boolean;
  loadDraft: () => void;
  clearDraft: () => boolean;
  flushDraft: () => boolean;
  recoverLegacyDraft: () => boolean;
  legacyAvailable: boolean;
  error: string | null;
}
interface ActiveDraft {
  key: string;
  value: SavedPostDraft;
  dirty: boolean;
  cleared: boolean;
}
const SAVE_ERROR =
  'This browser could not save your post draft. Your words are still here. Retry before closing.';

/** Account/context-scoped drafts flush before leaving; older unowned writing needs consent. */
export function usePostDraft(
  options: UsePostDraftOptions,
  state: PostDraftValue,
  setters: DraftSetters
): PostDraftController {
  const {
    ownerId,
    subjectType,
    subjectId,
    parentEventId,
    enableDrafts,
    debounceMs,
    defaultVisibility,
  } = options;
  const { content, visibility, selectedProjects } = state;
  const key =
    enableDrafts && ownerId ? postDraftKey(ownerId, subjectType, subjectId, parentEventId) : null;
  const oldKey = legacyPostDraftKey(subjectType, subjectId);
  const active = useRef<ActiveDraft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [legacyAvailable, setLegacyAvailable] = useState(false);
  const [reload, setReload] = useState(0);

  const flush = useCallback((draft: ActiveDraft | null, report: boolean): boolean => {
    if (!draft || !draft.dirty || draft.cleared) {
      return true;
    }
    const saved = writePostDraft(draft.key, draft.value);
    if (saved) {
      draft.dirty = false;
    }
    if (report) {
      setError(saved ? null : SAVE_ERROR);
    }
    return saved;
  }, []);

  useLayoutEffect(() => {
    clearTimeout(timer.current);
    setError(null);
    if (!key) {
      if (enableDrafts && active.current) {
        setters.setContent('');
        setters.setVisibility(defaultVisibility);
        setters.setSelectedProjects([]);
      }
      active.current = null;
      setLoadedKey(null);
      setLegacyAvailable(false);
      return;
    }
    const stored = readPostDraft(key);
    const value: SavedPostDraft =
      stored.kind === 'ready'
        ? stored.draft
        : {
            version: 2,
            content: '',
            visibility: defaultVisibility,
            selectedProjects: [],
            timestamp: Date.now(),
          };
    const draft: ActiveDraft = {
      key,
      value,
      dirty: stored.kind === 'ready' && Boolean(stored.pending),
      cleared: false,
    };
    active.current = draft;
    if (draft.dirty) {
      timer.current = setTimeout(() => flush(draft, true), debounceMs);
    }
    setters.setContent(value.content);
    setters.setVisibility(value.visibility);
    setters.setSelectedProjects(value.selectedProjects);
    setLoadedKey(key);
    const legacy = readLegacyPostDraft(oldKey);
    setLegacyAvailable(Boolean(legacy && legacy.raw !== value.recoveredLegacyRaw));
    if (stored.kind === 'unreadable') {
      setError(
        'An unreadable saved draft has been kept on this device. New writing will be saved separately from that copy.'
      );
    }
    return () => {
      clearTimeout(timer.current);
      flush(draft, false);
    };
  }, [key, oldKey, defaultVisibility, setters, reload, flush, enableDrafts, debounceMs]);

  useLayoutEffect(() => {
    const draft = active.current;
    if (!key || loadedKey !== key || draft?.key !== key) {
      return;
    }
    const same =
      draft.value.content === content &&
      draft.value.visibility === visibility &&
      JSON.stringify(draft.value.selectedProjects) === JSON.stringify(selectedProjects);
    if (same) {
      return;
    }
    draft.cleared = false;
    draft.value = { ...draft.value, content, visibility, selectedProjects, timestamp: Date.now() };
    draft.dirty = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(draft, true), debounceMs);
    return () => clearTimeout(timer.current);
  }, [key, loadedKey, content, visibility, selectedProjects, debounceMs, flush]);

  useEffect(() => {
    const save = () => flush(active.current, true);
    const hidden = () => {
      if (document.visibilityState === 'hidden') {
        save();
      }
    };
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [flush]);

  const flushDraft = useCallback(() => {
    clearTimeout(timer.current);
    if (enableDrafts && !key) {
      setError(SAVE_ERROR);
      return false;
    }
    if (active.current?.cleared) {
      const cleared = deletePostDraft(active.current.key);
      setError(
        cleared ? null : 'This browser could not clear its saved draft copy. Retry before leaving.'
      );
      return cleared;
    }
    return flush(active.current, true);
  }, [enableDrafts, key, flush]);
  const saveDraft = useCallback(
    (content: string) => {
      const draft = active.current;
      if (!draft) {
        return !enableDrafts;
      }
      draft.value = { ...draft.value, content, timestamp: Date.now() };
      draft.dirty = true;
      draft.cleared = false;
      return flushDraft();
    },
    [enableDrafts, flushDraft]
  );
  const clearDraft = useCallback(() => {
    clearTimeout(timer.current);
    const draft = active.current;
    if (!draft) {
      return true;
    }
    draft.cleared = true;
    draft.dirty = false;
    const cleared = deletePostDraft(draft.key);
    if (!cleared) {
      setError('This browser could not clear its saved draft copy. Retry before leaving.');
    }
    return cleared;
  }, []);
  const recoverLegacyDraft = useCallback(() => {
    const draft = active.current;
    const legacy = readLegacyPostDraft(oldKey);
    if (!draft || !legacy) {
      return false;
    }
    if (draft.value.recoveredLegacyRaw === legacy.raw) {
      setLegacyAvailable(false);
      return true;
    }
    const recovered: SavedPostDraft = {
      version: 2,
      content: draft.value.content.trim()
        ? `${draft.value.content}\n\n${legacy.value.content}`
        : legacy.value.content,
      visibility: 'private',
      selectedProjects: [],
      timestamp: Date.now(),
      recoveredLegacyRaw: legacy.raw,
    };
    if (!writePostDraft(draft.key, recovered, false)) {
      setError(
        'The older draft could not be recovered. Both original copies have been kept. Retry.'
      );
      return false;
    }
    draft.value = recovered;
    draft.dirty = false;
    draft.cleared = false;
    setters.setContent(recovered.content);
    setters.setVisibility(recovered.visibility);
    setters.setSelectedProjects([]);
    // Copy first. If removing the old source fails, the saved marker prevents duplicate recovery.
    removeLegacyPostDraft(oldKey);
    setLegacyAvailable(false);
    setError(null);
    return true;
  }, [oldKey, setters]);

  return {
    saveDraft,
    loadDraft: () => setReload(value => value + 1),
    clearDraft,
    flushDraft,
    recoverLegacyDraft,
    legacyAvailable,
    error,
  };
}

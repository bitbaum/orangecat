'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TimelineVisibility } from '@/types/timeline';
import {
  deleteLocalDraft,
  listLocalDrafts,
  newDraftId,
  saveLocalDraft,
  type LocalArticleDraft,
} from '@/services/articles/local-drafts';

interface DraftFields {
  title: string;
  excerpt: string;
  coverImage: string;
  body: string;
  visibility: TimelineVisibility;
}

interface DraftSetters {
  setTitle: (v: string) => void;
  setExcerpt: (v: string) => void;
  setCoverImage: (v: string) => void;
  setBody: (v: string) => void;
  setVisibility: (v: TimelineVisibility) => void;
}

/**
 * Local-draft persistence for the article composer: restore-on-mount,
 * debounced autosave, explicit flush (Cmd+S), and draft switching/deletion.
 * Flushes pending edits on navigation and when the page is hidden.
 */
export function useLocalArticleDrafts(
  isEditing: boolean,
  fields: DraftFields,
  setters: DraftSetters
) {
  const { title, excerpt, coverImage, body, visibility } = fields;
  const { setTitle, setExcerpt, setCoverImage, setBody, setVisibility } = setters;

  const pending = useRef<LocalArticleDraft | null>(null);
  const startedDraftId = useRef<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [restored, setRestored] = useState(false);
  const [draftId, setDraftId] = useState(() => newDraftId());
  const [otherDrafts, setOtherDrafts] = useState<LocalArticleDraft[]>([]);

  // Restore the most recent draft once on mount (new articles only — never
  // clobber an article being edited with a stale local draft). Older drafts
  // stay listed so starting a new article never destroys an in-progress one.
  useEffect(() => {
    if (isEditing) {
      return;
    }
    const drafts = listLocalDrafts();
    const [latest, ...rest] = drafts;
    if (latest) {
      setTitle(latest.title);
      setExcerpt(latest.excerpt);
      setCoverImage(latest.coverImage);
      setBody(latest.body);
      setVisibility(latest.visibility);
      setDraftId(latest.id);
      setRestored(true);
    }
    setOtherDrafts(rest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  // Keep the latest committed edit available to pagehide and unmount, even
  // when the debounce has not fired. Do not persist during render.
  useLayoutEffect(() => {
    if (title || body || excerpt || coverImage) {
      startedDraftId.current = draftId;
    }
    pending.current =
      !isEditing && startedDraftId.current === draftId
        ? { id: draftId, title, excerpt, coverImage, body, visibility, updatedAt: Date.now() }
        : null;
  }, [isEditing, draftId, title, excerpt, coverImage, body, visibility]);

  const persistPending = useCallback(() => {
    const draft = pending.current;
    if (!draft) {
      return null;
    }
    const saved = saveLocalDraft(draft);
    if (saved) {
      pending.current = null;
    }
    return saved;
  }, []);

  const flushDraftNow = useCallback(() => {
    const saved = persistPending();
    if (saved !== null) {
      setSaveStatus(saved ? 'saved' : 'error');
    }
    return saved;
  }, [persistPending]);

  useEffect(() => {
    if (!pending.current) {
      setSaveStatus('idle');
      return;
    }
    setSaveStatus('saving');
    const timer = setTimeout(flushDraftNow, 600);
    return () => clearTimeout(timer);
  }, [isEditing, draftId, title, excerpt, coverImage, body, visibility, flushDraftNow]);

  useEffect(() => {
    const flush = () => {
      flushDraftNow();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      persistPending();
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [persistPending, flushDraftNow]);

  // Publishing/discarding must not be resurrected by the unmount flush.
  function completeDraft() {
    pending.current = null;
    deleteLocalDraft(draftId);
  }

  /** Delete the current draft and reset to a blank one; other drafts survive. */
  function discardCurrentDraft() {
    completeDraft();
    setTitle('');
    setExcerpt('');
    setCoverImage('');
    setBody('');
    setVisibility('public');
    setDraftId(newDraftId());
    setRestored(false);
    setOtherDrafts(listLocalDrafts());
  }

  /** Preserve the current writing before replacing the fields. */
  function loadDraft(draft: LocalArticleDraft) {
    if (flushDraftNow() === false) {
      return false;
    }
    setTitle(draft.title);
    setExcerpt(draft.excerpt);
    setCoverImage(draft.coverImage);
    setBody(draft.body);
    setVisibility(draft.visibility);
    setDraftId(draft.id);
    setRestored(true);
    setOtherDrafts(listLocalDrafts().filter(d => d.id !== draft.id));
    return true;
  }

  function deleteOtherDraft(id: string) {
    deleteLocalDraft(id);
    setOtherDrafts(prev => prev.filter(d => d.id !== id));
  }

  return {
    draftId,
    saveStatus,
    completeDraft,
    restored,
    setRestored,
    otherDrafts,
    flushDraftNow,
    discardCurrentDraft,
    loadDraft,
    deleteOtherDraft,
  };
}

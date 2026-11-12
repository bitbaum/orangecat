'use client';

/**
 * The `@` menu: what to offer, and what the keyboard does while it is open.
 *
 * Headless on purpose. It never touches a DOM node itself — it is handed a
 * `CaretSurface` and talks only through that — so the same hook drives the
 * message textarea and the contentEditable post composer, and a test can drive
 * it with a plain object. What it renders as is `MentionSuggestions`, which in
 * turn does no fetching. Neither half can grow into the other.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { activeMention } from '@/domain/mentions/parse';
import {
  MENTION_SUGGESTION_LIMIT,
  rankMentionSuggestions,
  type MentionCandidateProfile,
  type MentionSuggestion,
} from '@/domain/mentions/rank';
import { CAT_USERNAME } from '@/config/cat-identity';
import type { CaretSurface } from '@/components/mentions/caret';

/**
 * Long enough that typing a whole handle is one request rather than six, short
 * enough that the menu feels attached to the keyboard.
 */
const DEBOUNCE_MS = 120;

/** Over-fetch a little so ranking has something to reorder. */
const FETCH_LIMIT = 12;

interface ProfilesResponse {
  data?: MentionCandidateProfile[];
}

async function fetchProfiles(
  search: string,
  signal: AbortSignal
): Promise<MentionCandidateProfile[]> {
  const url = `/api/profiles?limit=${FETCH_LIMIT}&search=${encodeURIComponent(search)}`;
  const response = await fetch(url, { signal, credentials: 'same-origin' });
  if (!response.ok) {
    return [];
  }
  const body = (await response.json()) as ProfilesResponse;
  return Array.isArray(body.data) ? body.data : [];
}

/**
 * The Cat's profile, fetched once per page and shared by every composer on it.
 *
 * A module-level promise rather than per-hook state because the Cat is one
 * fixed account whose row does not change while you are typing, and because a
 * page with a composer per post would otherwise ask for it once per composer.
 * A failed lookup is not cached — the next composer retries — so a blip does
 * not hide the Cat for the rest of the session.
 */
let catProfilePromise: Promise<MentionCandidateProfile | null> | null = null;

function loadCatProfile(): Promise<MentionCandidateProfile | null> {
  if (!catProfilePromise) {
    catProfilePromise = fetchProfiles(CAT_USERNAME, new AbortController().signal)
      .then(profiles => {
        const cat =
          profiles.find(p => p.username?.toLowerCase() === CAT_USERNAME.toLowerCase()) ?? null;
        if (!cat) {
          catProfilePromise = null;
        }
        return cat;
      })
      .catch(() => {
        catProfilePromise = null;
        return null;
      });
  }
  return catProfilePromise;
}

/** Exported for tests, which must not inherit another test's cached Cat. */
export function __resetCatProfileCache(): void {
  catProfilePromise = null;
}

interface UseMentionAutocompleteOptions {
  /** How to read and rewrite the editor. Re-created each render is fine. */
  surface: CaretSurface;
  /** Suppress the menu entirely, e.g. while the composer is submitting. */
  disabled?: boolean;
}

export interface MentionAutocomplete {
  open: boolean;
  items: MentionSuggestion[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  /** Call after anything that can move the caret: input, click, arrow keys. */
  refresh: () => void;
  /** @returns true when the menu consumed the key and the composer must not act on it. */
  handleKeyDown: (event: React.KeyboardEvent) => boolean;
  /** Insert a suggestion in place of the handle being typed. */
  pick: (suggestion: MentionSuggestion) => void;
  /** Escape: stay shut for THIS handle even as it is typed further. */
  dismiss: () => void;
  /** Blur and similar: shut for now, and reopen the moment typing resumes. */
  close: () => void;
}

export function useMentionAutocomplete({
  surface,
  disabled = false,
}: UseMentionAutocompleteOptions): MentionAutocomplete {
  const [query, setQuery] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  const [caret, setCaret] = useState(0);
  const [people, setPeople] = useState<MentionCandidateProfile[]>([]);
  const [cat, setCat] = useState<MentionCandidateProfile | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // Escape closes the menu for the handle you are on; typing a different one
  // must bring it back, so remember WHICH mention was dismissed, not just that
  // something was.
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  // The surface is a fresh object every render; a ref keeps callbacks stable
  // without listing it as a dependency and re-running effects on every keypress.
  const surfaceRef = useRef(surface);
  surfaceRef.current = surface;

  const refresh = useCallback(() => {
    if (disabled) {
      setQuery(null);
      return;
    }
    const before = surfaceRef.current.readTextBeforeCaret();
    if (before === null) {
      setQuery(null);
      return;
    }
    const mention = activeMention(before);
    if (!mention) {
      setQuery(null);
      return;
    }
    setQuery(mention.query);
    setStart(mention.start);
    setCaret(before.length);
  }, [disabled]);

  useEffect(() => {
    if (query === null) {
      return;
    }
    let cancelled = false;
    loadCatProfile().then(profile => {
      if (!cancelled) {
        setCat(profile);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    if (query === null) {
      setPeople([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchProfiles(query, controller.signal)
        .then(setPeople)
        .catch(() => {
          /* aborted or offline: keep whatever is on screen rather than flashing empty */
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const items = useMemo(
    () => (query === null ? [] : rankMentionSuggestions(query, people, cat)),
    [query, people, cat]
  );

  // A shorter list must not leave the highlight pointing past the end.
  useEffect(() => {
    setActiveIndex(current => (current >= items.length ? 0 : current));
  }, [items.length]);

  const open = query !== null && items.length > 0 && dismissedAt !== start;

  const dismiss = useCallback(() => setDismissedAt(start), [start]);

  const close = useCallback(() => setQuery(null), []);

  const pick = useCallback(
    (suggestion: MentionSuggestion) => {
      // The trailing space both ends the mention and puts the caret where the
      // next word goes, so choosing from the menu never needs a second keystroke.
      surfaceRef.current.replaceRange(start, caret, `@${suggestion.username} `);
      setQuery(null);
      setActiveIndex(0);
    },
    [start, caret]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent): boolean => {
      if (!open) {
        return false;
      }
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setActiveIndex(i => (i + 1) % items.length);
          return true;
        case 'ArrowUp':
          event.preventDefault();
          setActiveIndex(i => (i - 1 + items.length) % items.length);
          return true;
        case 'Enter':
        case 'Tab': {
          const chosen = items[activeIndex];
          if (!chosen) {
            return false;
          }
          // Enter would otherwise send the message or submit the post. The menu
          // is open and something is highlighted, so it means "pick this".
          event.preventDefault();
          pick(chosen);
          return true;
        }
        case 'Escape':
          event.preventDefault();
          dismiss();
          return true;
        default:
          return false;
      }
    },
    [open, items, activeIndex, pick, dismiss]
  );

  return {
    open,
    items: open ? items : [],
    activeIndex,
    setActiveIndex,
    refresh,
    handleKeyDown,
    pick,
    dismiss,
    close,
  };
}

export { MENTION_SUGGESTION_LIMIT };

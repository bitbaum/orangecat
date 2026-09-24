/**
 * USE CAT HOME
 * Fetches what the Cat opens an empty chat with, and tracks which openers the
 * user has waved off ("not now").
 *
 * Starts from the registry-derived starters so the empty state is never blank,
 * then replaces them with the generated, state-grounded home.
 *
 * Dismissals live in localStorage: a per-viewer convenience, not a record. If
 * storage is unavailable the Cat simply brings the topic up again — nothing
 * breaks. A dismissal expires after a week, because "not now" is not "never".
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import {
  STARTER_HOME,
  type CatHome,
  type CatOpener,
  type CatReference,
} from '@/config/cat-prompts';

const DISMISS_STORAGE_KEY = 'cat:dismissed-openers';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Dismissed = Record<string, number>;

function readDismissed(): Dismissed {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(parsed as Dismissed).filter(
        ([, at]) => typeof at === 'number' && now - at < DISMISS_TTL_MS
      )
    );
  } catch {
    return {};
  }
}

function writeDismissed(value: Dismissed): void {
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable — the dismissal lasts for this page view only.
  }
}

const isString = (v: unknown): v is string => typeof v === 'string' && !!v.trim();

/** The payload crosses the network, so trust only what type-checks here. */
export function parseCatHome(value: unknown): CatHome | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const { openers, chips, attachable } = value as {
    openers?: unknown;
    chips?: unknown;
    attachable?: unknown;
  };
  const parsedOpeners: CatOpener[] = Array.isArray(openers)
    ? openers.flatMap(o => {
        const c = o as Partial<CatOpener>;
        if (!c || !isString(c.key) || !isString(c.say)) {
          return [];
        }
        const replies = Array.isArray(c.replies) ? c.replies.filter(isString) : [];
        return [{ key: c.key, say: c.say, replies }];
      })
    : [];
  const parsedChips = Array.isArray(chips) ? chips.filter(isString) : [];
  const parsedAttachable: CatReference[] = Array.isArray(attachable)
    ? attachable.filter((r): r is CatReference => {
        const c = r as Partial<CatReference>;
        return !!c && isString(c.type) && isString(c.id) && isString(c.title);
      })
    : [];
  if (parsedOpeners.length === 0 && parsedChips.length === 0) {
    return null;
  }
  return { openers: parsedOpeners, chips: parsedChips, attachable: parsedAttachable };
}

export function useSuggestions() {
  const [home, setHome] = useState<CatHome>(STARTER_HOME);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [dismissed, setDismissed] = useState<Dismissed>({});

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const fetchHome = async () => {
      try {
        const res = await fetch(API_ROUTES.CAT.SUGGESTIONS, { signal: controller.signal });
        if (!res.ok || controller.signal.aborted) {
          return;
        }
        const data = await res.json();
        const parsed = data.success ? parseCatHome(data.data) : null;
        if (parsed && !controller.signal.aborted) {
          setHome(parsed);
        }
      } catch (e) {
        if ((e as { name?: string }).name === 'AbortError') {
          return;
        }
        // Keep the starters on error
        logger.error('Failed to fetch Cat home', { error: e }, 'useSuggestions');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSuggestions(false);
        }
      }
    };

    void fetchHome();
    return () => controller.abort();
  }, []);

  const opener = useMemo(
    () => home.openers.find(o => !dismissed[o.key]) ?? null,
    [home.openers, dismissed]
  );

  // Chips never repeat what the opener already offers as a reply.
  const chips = useMemo(() => {
    const taken = new Set((opener?.replies ?? []).map(r => r.toLowerCase()));
    return home.chips.filter(c => !taken.has(c.toLowerCase()));
  }, [home.chips, opener]);

  const dismissOpener = useCallback((key: string) => {
    setDismissed(prev => {
      const next = { ...prev, [key]: Date.now() };
      writeDismissed(next);
      return next;
    });
  }, []);

  return { opener, chips, attachable: home.attachable, dismissOpener, isLoadingSuggestions };
}

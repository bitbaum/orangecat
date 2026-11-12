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
  type CatToday,
  type CatTodayLine,
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

/** A link the home may render: an app path, or an http(s) URL. Nothing else. */
const isHref = (v: unknown): v is string =>
  isString(v) && ((v.startsWith('/') && !v.startsWith('//')) || /^https?:\/\//i.test(v));

function parseToday(value: unknown): CatToday | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const { lines, day } = value as { lines?: unknown; day?: unknown };
  const parsedLines: CatTodayLine[] = Array.isArray(lines)
    ? lines.flatMap(l => {
        const c = l as Partial<CatTodayLine>;
        if (!c || !isString(c.key) || !isString(c.text) || !isHref(c.href)) {
          return [];
        }
        return [{ key: c.key, text: c.text, href: c.href, urgent: c.urgent === true }];
      })
    : [];
  const d = day as { label?: unknown; href?: unknown } | null | undefined;
  return {
    lines: parsedLines,
    day: d && isString(d.label) && isHref(d.href) ? { label: d.label, href: d.href } : null,
  };
}

/** The payload crosses the network, so trust only what type-checks here. */
export function parseCatHome(value: unknown): CatHome | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const { today, openers, chips, attachable } = value as {
    today?: unknown;
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
  const parsedToday = parseToday(today);
  if (parsedOpeners.length === 0 && parsedChips.length === 0 && !parsedToday) {
    return null;
  }
  return {
    today: parsedToday,
    openers: parsedOpeners,
    chips: parsedChips,
    attachable: parsedAttachable,
  };
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
        // The brief is written for the viewer's day, so the server needs their zone.
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const url = zone
          ? `${API_ROUTES.CAT.SUGGESTIONS}?tz=${encodeURIComponent(zone)}`
          : API_ROUTES.CAT.SUGGESTIONS;
        const res = await fetch(url, { signal: controller.signal });
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

  // What needs them today comes first; the Cat brings up a standing topic
  // only when nothing does, so the home is never two cards deep.
  const opener = useMemo(
    () => (home.today?.lines.length ? null : (home.openers.find(o => !dismissed[o.key]) ?? null)),
    [home.today, home.openers, dismissed]
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

  return {
    today: home.today,
    opener,
    chips,
    attachable: home.attachable,
    dismissOpener,
    isLoadingSuggestions,
  };
}

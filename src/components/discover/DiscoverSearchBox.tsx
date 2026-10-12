'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, X } from 'lucide-react';
import { DISCOVER_HERO } from '@/config/discover-tabs';
import { discoverHref } from '@/services/discover/params';
import type { PublicHitType } from '@/services/search/public-search';

/** Pause after the last keystroke before the results follow it. */
const DEBOUNCE_MS = 300;

/**
 * Discover's search field. Results follow as you type (debounced) and the
 * query lives in the URL, so a search can be shared and Back returns to it.
 * It is also a plain GET form: with no JavaScript, Enter still searches.
 */
export function DiscoverSearchBox({
  initialQuery,
  type,
}: {
  initialQuery: string;
  type: PublicHitType | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const committed = useRef(initialQuery);

  // The query changed from outside this field (a link, Back): follow it. Our
  // own navigations already match `committed`, so typing that continued
  // while the results loaded is never overwritten by the older query.
  useEffect(() => {
    if (initialQuery.trim() !== committed.current.trim()) {
      committed.current = initialQuery;
      setValue(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    const next = value.trim();
    if (next === committed.current.trim()) {
      return;
    }
    const timer = setTimeout(() => {
      committed.current = next;
      startTransition(() => router.replace(discoverHref({ q: next, type }), { scroll: false }));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, type, router]);

  return (
    <form
      action="/discover"
      role="search"
      className="oc-discover-search"
      onSubmit={e => {
        e.preventDefault();
        committed.current = value.trim();
        startTransition(() => router.push(discoverHref({ q: value, type })));
      }}
    >
      {pending ? (
        <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-fg-tertiary" aria-hidden />
      ) : (
        <Search className="h-5 w-5 flex-shrink-0 text-fg-tertiary" aria-hidden />
      )}
      <input
        type="search"
        name="q"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={DISCOVER_HERO.searchPlaceholder}
        aria-label="Search everything on OrangeCat"
        autoComplete="off"
        enterKeyHint="search"
        className="oc-discover-search-input"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue('')}
          aria-label="Clear search"
          className="flex min-h-11 min-w-11 items-center justify-center text-fg-tertiary hover:text-fg-primary"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}

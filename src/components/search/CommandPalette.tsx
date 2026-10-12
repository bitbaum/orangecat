'use client';

/**
 * Command palette — the ⌘K overlay behind the header's "Search or jump to…".
 *
 * Opens from either header trigger, ⌘K / Ctrl+K anywhere, or "/" outside a
 * text field (see CommandPaletteHost). On a phone it fills the screen, with
 * the field pinned at the top, because the keyboard leaves half of it.
 *
 * Empty, it shows what this browser searched for and opened lately, then
 * pages and create. Typed, it shows:
 *   - your own things (GET /api/things), ranked by listkit;
 *   - everyone's, from search_public — the same engine as /discover, so
 *     "See all results" never loses what was just on screen — grouped by kind
 *     with the matched words picked out;
 *   - "See all results" (⌘ Enter) and "Ask your Cat", which also answers when
 *     nothing public matches: a sentence is often a task the Cat can set up.
 *
 * cmdk handles arrows, Enter and Esc; its own filter is OFF so one engine
 * decides what each group shows.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Cat, Clock, Search } from 'lucide-react';
import {
  buildCreateItems,
  buildPages,
  groupHits,
  iconForType,
  rankItems,
  thingItems,
  typeHeading,
} from './command-palette-items';
import { GROUP_HEADING, PaletteGroup, PaletteRow } from './PaletteRows';
import { logSearch } from './search-log';
import { forgetRecents, readRecents, rememberRecent, type RecentEntry } from './recent-searches';
import { ROUTES } from '@/config/routes';
import { API_ROUTES } from '@/config/api-routes';
import { CAT_QUERY_PARAM } from '@/config/cat-door';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { cn } from '@/lib/utils';
import type { Thing } from '@/domain/things/service';

/** Rows per local group: enough to see the right one, few enough to scan. */
const GROUP_LIMIT = { things: 5, pages: 6, create: 5 } as const;

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const typed = query.trim();
  const searching = open && typed.length > 1;
  const { results: hits, total, loading } = useGlobalSearch(query, searching);

  // Fresh on every open: an empty field and this browser's latest recents.
  useEffect(() => {
    if (open) {
      setRecents(readRecents());
    } else {
      setQuery('');
    }
  }, [open]);

  // Your things, fetched once per page load on first open. Signed out (401)
  // or failed: an empty list, never an error in a search box.
  const [things, setThings] = useState<Thing[] | null>(null);
  useEffect(() => {
    if (!open || things !== null) {
      return;
    }
    let live = true;
    fetch(API_ROUTES.THINGS)
      .then(r => (r.ok ? r.json() : null))
      .then(d => live && setThings(d?.data?.things ?? []))
      .catch(() => live && setThings([]));
    return () => {
      live = false;
    };
  }, [open, things]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const navigateTo = useCallback(
    (href: string, recent?: RecentEntry) => {
      if (recent) {
        rememberRecent(recent);
      }
      close();
      router.push(href);
    },
    [close, router]
  );

  const seeAll = useCallback(() => {
    if (!typed) {
      return;
    }
    logSearch(typed, total);
    const href = `${ROUTES.DISCOVER}?q=${encodeURIComponent(typed)}`;
    navigateTo(href, { kind: 'search', label: typed, href });
  }, [typed, total, navigateTo]);

  const pages = useMemo(() => buildPages(), []);
  const creates = useMemo(() => buildCreateItems(), []);
  const mine = useMemo(() => thingItems(things ?? []), [things]);
  const shownThings = typed ? rankItems(mine, typed, GROUP_LIMIT.things) : [];
  const shownPages = rankItems(pages, typed, GROUP_LIMIT.pages);
  const shownCreates = rankItems(creates, typed, GROUP_LIMIT.create);
  const groups = searching ? groupHits(hits) : [];
  // Said only when nothing at all matched: a page or your own thing found by
  // the same words is an answer, not "nothing".
  const nothingPublic =
    searching &&
    !loading &&
    hits.length === 0 &&
    shownThings.length + shownPages.length + shownCreates.length === 0;

  if (!open) {
    return null;
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Search"
      shouldFilter={false}
      className={cn(
        'fixed inset-0 z-[100] flex flex-col overflow-hidden bg-surface-page',
        'sm:inset-auto sm:left-1/2 sm:top-[12vh] sm:w-[min(640px,calc(100vw-2rem))] sm:-translate-x-1/2',
        'sm:rounded-md sm:border sm:border-subtle sm:shadow-2xl'
      )}
      overlayClassName="fixed inset-0 z-[99] bg-black/60 backdrop-blur-sm"
    >
      {/* Radix Dialog needs a Title for screen readers; the field is the visible focus. */}
      <VisuallyHidden.Root>
        <DialogPrimitive.Title>Search</DialogPrimitive.Title>
      </VisuallyHidden.Root>
      <div className="flex items-center border-b border-subtle px-3.5">
        <Search className="h-4 w-4 flex-shrink-0 text-fg-tertiary" aria-hidden />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search people, projects, things to buy…"
          className="min-h-12 w-full border-0 bg-transparent px-3 py-3.5 text-base text-fg-primary shadow-none outline-none ring-0 placeholder:text-fg-tertiary focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-sm"
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              seeAll();
            }
          }}
        />
        <kbd className="hidden flex-shrink-0 rounded border border-subtle bg-surface-raised/40 px-1.5 py-0.5 text-2xs text-fg-secondary sm:inline">
          ESC
        </kbd>
        <button
          type="button"
          onClick={close}
          className="min-h-11 flex-shrink-0 px-1 text-sm text-fg-secondary sm:hidden"
        >
          Cancel
        </button>
      </div>

      <Command.List className="flex-1 overflow-y-auto p-2 sm:max-h-[60vh] sm:flex-none">
        {!typed && recents.length > 0 && (
          <Command.Group heading="Recent" className={GROUP_HEADING}>
            {recents.map(entry => (
              <PaletteRow
                key={entry.href}
                value={`recent-${entry.href}`}
                icon={entry.kind === 'search' ? Clock : iconForType(entry.type ?? '')}
                label={entry.label}
                hint={entry.kind === 'search' ? 'Search' : typeHeading(entry.type ?? '')}
                onSelect={() => navigateTo(entry.href, entry)}
              />
            ))}
            <PaletteRow
              value="recent-clear"
              icon={Clock}
              label="Clear recent"
              muted
              onSelect={() => {
                forgetRecents();
                setRecents([]);
              }}
            />
          </Command.Group>
        )}

        <PaletteGroup heading="Your things" items={shownThings} query={typed} onPick={navigateTo} />

        {groups.map(group => (
          <Command.Group
            key={group.type}
            heading={typeHeading(group.type)}
            className={GROUP_HEADING}
          >
            {group.hits.map(hit => (
              <PaletteRow
                key={`${hit.type}-${hit.id}`}
                value={`hit-${hit.type}-${hit.id}`}
                icon={iconForType(hit.type)}
                label={hit.title}
                hint={hit.handle ? `@${hit.handle}` : hit.snippet}
                query={typed}
                labelRanges={hit.marks.title}
                hintRanges={hit.handle ? undefined : hit.marks.snippet}
                onSelect={() =>
                  navigateTo(hit.href, {
                    kind: 'hit',
                    label: hit.title,
                    href: hit.href,
                    type: hit.type,
                  })
                }
              />
            ))}
          </Command.Group>
        ))}

        {searching && loading && hits.length === 0 && (
          <div className="px-3 py-2 text-xs text-fg-tertiary">Searching…</div>
        )}
        <PaletteGroup heading="Jump to" items={shownPages} query={typed} onPick={navigateTo} />

        {nothingPublic && (
          <p className="px-3 py-3 text-sm text-fg-secondary">
            Nothing public matches “{typed}” yet. Your Cat can look further, or set it up.
          </p>
        )}

        {typed && (
          <Command.Group heading="More" className={GROUP_HEADING}>
            {hits.length > 0 && (
              <PaletteRow
                icon={Search}
                label={total > hits.length ? `See all ${total} results` : 'See all results'}
                hint="⌘ Enter"
                onSelect={seeAll}
                value="search-discover"
              />
            )}
            <PaletteRow
              icon={Cat}
              label={`Ask your Cat: “${typed}”`}
              hint="It can find it or set it up"
              onSelect={() =>
                navigateTo(
                  `${ROUTES.DASHBOARD.CAT}?${CAT_QUERY_PARAM}=${encodeURIComponent(typed)}`
                )
              }
              value="ask-cat"
            />
          </Command.Group>
        )}

        <PaletteGroup heading="Create" items={shownCreates} query={typed} onPick={navigateTo} />
      </Command.List>
    </Command.Dialog>
  );
}

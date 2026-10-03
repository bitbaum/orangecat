'use client';

/**
 * Command palette — Linear/Stripe-style ⌘K overlay.
 *
 * Replaces the inline dropdown that EnhancedSearchBar used to render
 * for desktop. Mobile keeps a full-width form below md.
 *
 * Open triggers:
 *   - Click any palette trigger (header search button or mobile search icon)
 *   - Keyboard: ⌘K (Mac) / Ctrl+K (Win/Linux), from anywhere in the app
 *   - "/" while focus isn't already in an input (Slack-style)
 *
 * Inside the palette:
 *   - cmdk handles arrow-key nav + Enter + Esc natively; its own filter is
 *     OFF — listkit ranks the local lists (every word, any order, accents
 *     folded) and global_search ranks the server hits, so one engine decides
 *     what a group shows instead of two disagreeing.
 *   - Typing offers "Ask your Cat" first: a sentence is often a task, and the
 *     Cat can set the whole thing up (profile, project, website, backers).
 *   - Your own things (GET /api/things), then pages, create, and everyone's.
 *
 * Created: 2026-06-03
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowRight, Cat, Search } from 'lucide-react';
import {
  buildCreateItems,
  buildPages,
  hrefForHit,
  iconForHit,
  rankItems,
  thingItems,
  type PaletteItem,
} from './command-palette-items';
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
  const { results: hits, loading: hitsLoading } = useGlobalSearch(
    query,
    open && query.trim().length > 1
  );

  // Reset query on close so the next ⌘K opens fresh.
  useEffect(() => {
    if (!open) {
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
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  const submitFullSearch = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) {
        return;
      }
      // Log the committed search as an aggregate demand signal, with the instant
      // cross-entity result count — 0 means nothing matched (the sharpest unmet-demand
      // signal). No PII; sendBeacon survives the navigation that follows.
      try {
        const payload = JSON.stringify({ query: trimmed, resultCount: hits.length });
        const beacon = navigator.sendBeacon?.bind(navigator);
        if (beacon) {
          beacon(API_ROUTES.SEARCH.LOG, new Blob([payload], { type: 'application/json' }));
        } else {
          void fetch(API_ROUTES.SEARCH.LOG, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        /* logging must never disrupt search */
      }
      close();
      router.push(`${ROUTES.DISCOVER}?q=${encodeURIComponent(trimmed)}`);
    },
    [close, router, hits]
  );

  const pages = useMemo(() => buildPages(), []);
  const creates = useMemo(() => buildCreateItems(), []);
  const mine = useMemo(() => thingItems(things ?? []), [things]);
  const typed = query.trim();
  const shownThings = typed ? rankItems(mine, typed, GROUP_LIMIT.things) : [];
  const shownPages = rankItems(pages, typed, GROUP_LIMIT.pages);
  const shownCreates = rankItems(creates, typed, GROUP_LIMIT.create);

  if (!open) {
    return null;
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      shouldFilter={false}
      className={cn(
        'fixed left-1/2 top-[15vh] z-[100] w-[min(640px,calc(100vw-2rem))]',
        '-translate-x-1/2 overflow-hidden rounded-md',
        'border border-subtle bg-surface-page shadow-2xl'
      )}
      overlayClassName="fixed inset-0 z-[99] bg-black/60 backdrop-blur-sm"
    >
      {/* Radix Dialog (underneath cmdk's Command.Dialog) requires a Title
          for screen readers — the `label` prop alone isn't enough and
          logs a runtime error in dev. Visually hide it; cmdk renders the
          Search input below as the user-facing focus. */}
      <VisuallyHidden.Root>
        <DialogPrimitive.Title>Command palette</DialogPrimitive.Title>
      </VisuallyHidden.Root>
      <div className="flex items-center border-b border-subtle px-3.5">
        <Search className="h-4 w-4 flex-shrink-0 text-fg-tertiary" aria-hidden />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search or jump to…"
          className="w-full bg-transparent px-3 py-3.5 text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none"
          onKeyDown={e => {
            // Cmd/Ctrl+Enter does a full search rather than picking the
            // focused item. Plain Enter on no-match also falls through.
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submitFullSearch(query);
            }
          }}
        />
        <kbd className="hidden flex-shrink-0 rounded border border-subtle bg-surface-raised/40 px-1.5 py-0.5 text-2xs text-fg-secondary sm:inline">
          ESC
        </kbd>
      </div>

      <Command.List className="max-h-[60vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-8 text-center text-sm text-fg-secondary">
          No matches. Press{' '}
          <kbd className="rounded border border-subtle bg-surface-raised/40 px-1.5 py-0.5 text-2xs">
            ⌘ Enter
          </kbd>{' '}
          to search everyone.
        </Command.Empty>

        {typed && (
          <Command.Group heading="Ask" className={GROUP_HEADING}>
            <PaletteRow
              icon={Cat}
              label={`Ask your Cat: "${typed}"`}
              hint="It can set it up for you"
              onSelect={() =>
                navigateTo(
                  `${ROUTES.DASHBOARD.CAT}?${CAT_QUERY_PARAM}=${encodeURIComponent(typed)}`
                )
              }
              value="ask-cat"
            />
            <PaletteRow
              icon={Search}
              label={`Search everyone for "${typed}"`}
              hint="⌘ Enter"
              onSelect={() => submitFullSearch(query)}
              value="search-discover"
            />
          </Command.Group>
        )}

        <PaletteGroup heading="Your things" items={shownThings} onPick={navigateTo} />
        <PaletteGroup heading="Jump to" items={shownPages} onPick={navigateTo} />
        <PaletteGroup heading="Create" items={shownCreates} onPick={navigateTo} />

        {query.trim().length > 1 && hits.length > 0 && (
          <Command.Group heading="Everyone" className={GROUP_HEADING}>
            {hits.map(hit => (
              <PaletteRow
                key={`${hit.entity_type}-${hit.id}`}
                value={`hit-${hit.entity_type}-${hit.id}`}
                icon={iconForHit(hit)}
                label={hit.title}
                hint={hit.subtitle ?? hit.entity_type}
                onSelect={() => navigateTo(hrefForHit(hit))}
              />
            ))}
          </Command.Group>
        )}

        {hitsLoading && <div className="px-3 py-2 text-xs text-fg-tertiary">Searching…</div>}
      </Command.List>
    </Command.Dialog>
  );
}

// Styles the HEADING only. On the group itself the uppercase was inherited by
// every row, so results read in capitals ("BITCOIN MEETUP ZÜRICH").
const GROUP_HEADING =
  'mt-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-tertiary';

function PaletteGroup({
  heading,
  items,
  onPick,
}: {
  heading: string;
  items: PaletteItem[];
  onPick: (href: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <Command.Group heading={heading} className={GROUP_HEADING}>
      {items.map(item => (
        <PaletteRow
          key={item.id}
          value={item.id}
          icon={item.icon}
          label={item.label}
          hint={item.hint}
          onSelect={() => onPick(item.href)}
        />
      ))}
    </Command.Group>
  );
}

interface PaletteRowProps {
  value: string;
  icon: PaletteItem['icon'];
  label: string;
  hint?: string;
  onSelect: () => void;
}

function PaletteRow({ value, icon: Icon, label, hint, onSelect }: PaletteRowProps) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm',
        'aria-selected:bg-surface-raised/60 aria-selected:text-fg-primary',
        'text-fg-secondary transition-colors'
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="min-w-0 truncate text-fg-primary">{label}</span>
      {hint && (
        <span className="hidden min-w-0 truncate text-xs text-fg-tertiary sm:inline">{hint}</span>
      )}
      <ArrowRight className="ml-auto h-3.5 w-3.5 flex-shrink-0 opacity-0 group-aria-selected:opacity-100" />
    </Command.Item>
  );
}

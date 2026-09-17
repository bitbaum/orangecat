'use client';

/**
 * SearchTrigger — replaces the inline EnhancedSearchBar in the header.
 *
 * Shows as a search-icon button with a placeholder and ⌘K kbd hint
 * (matches Linear / Stripe). Click OR press ⌘K anywhere in
 * the app opens the CommandPalette. The "/" hotkey also opens it when
 * focus isn't already in an input (Slack/GitHub-style).
 *
 * Two states:
 *   - Inline (default header use) — full-width pill with placeholder
 *   - Icon-only (compact prop) — single button for tight header rails
 *
 * Created: 2026-06-03
 */

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { CommandPalette } from './CommandPalette';
import { HeaderIconButton } from '@/components/layout/HeaderIconButton';
import { cn } from '@/lib/utils';

interface SearchTriggerProps {
  compact?: boolean;
  className?: string;
}

const PLACEHOLDER = 'Search or jump to…';

export function SearchTrigger({ compact = false, className }: SearchTriggerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K from anywhere.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
        return;
      }
      // "/" hotkey when focus isn't already in an input. Read the composed-path
      // leaf, not e.target: when the keystroke originates inside a shadow root
      // (e.g. the embedded Loki feedback widget's textarea) the event
      // retargets to the shadow host, so e.target misreads a text field as
      // "not typing" and the palette steals the keystroke mid-sentence.
      if (e.key === '/' && !isTypingTarget(e.composedPath()[0] ?? e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      {compact ? (
        // Tight header rail — share geometry with the rest of the action row.
        <HeaderIconButton
          icon={Search}
          label="Open search"
          onClick={() => setOpen(true)}
          className={className}
        />
      ) : (
        // Inline pill with placeholder + ⌘K hint (Linear / Stripe).
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open search"
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-subtle bg-surface-raised/40 px-3 text-sm text-fg-secondary',
            'transition-colors hover:bg-surface-raised/60 hover:text-fg-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
            className
          )}
        >
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4 flex-shrink-0" aria-hidden />
            <span className="truncate">{PLACEHOLDER}</span>
          </span>
          <kbd className="hidden flex-shrink-0 items-center rounded border border-subtle bg-surface-page px-1.5 py-0.5 text-2xs font-medium text-fg-tertiary sm:inline-flex">
            ⌘K
          </kbd>
        </button>
      )}
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

'use client';

/**
 * The `@` menu, as it appears.
 *
 * Presentational only — it is handed a list and told which row is highlighted.
 * It does not fetch, rank, or know what a mention is, so the fact that the Cat
 * sits at the top is a decision made in `domain/mentions/rank.ts` and merely
 * rendered here.
 *
 * `onMouseDown` rather than `onClick` on a row, and `preventDefault` with it,
 * because a click steals focus from the editor before the handler runs and the
 * caret we are about to write at would be gone.
 */

import React from 'react';
import Image from 'next/image';
import DefaultAvatar from '@/components/ui/DefaultAvatar';
import { cn } from '@/lib/utils';
import type { MentionSuggestion } from '@/domain/mentions/rank';

export interface MentionSuggestionsProps {
  items: MentionSuggestion[];
  activeIndex: number;
  onPick: (suggestion: MentionSuggestion) => void;
  onHover: (index: number) => void;
  /** Where the menu sits relative to the editor. Messages compose at the bottom of the screen. */
  placement?: 'above' | 'below';
  /** Ties the editor's `aria-activedescendant` to the highlighted row. */
  idPrefix?: string;
}

export default function MentionSuggestions({
  items,
  activeIndex,
  onPick,
  onHover,
  placement = 'below',
  idPrefix = 'mention',
}: MentionSuggestionsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute left-0 z-50 w-full max-w-xs overflow-hidden rounded-md border border-subtle',
        'bg-surface-raised shadow-lg',
        placement === 'above' ? 'bottom-full mb-2' : 'top-full mt-1'
      )}
      role="listbox"
      aria-label="Mention suggestions"
      id={`${idPrefix}-listbox`}
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          id={`${idPrefix}-option-${index}`}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          onMouseDown={event => {
            event.preventDefault();
            onPick(item);
          }}
          onMouseEnter={() => onHover(index)}
          className={cn(
            'flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
            index === activeIndex ? 'bg-surface-base' : 'bg-transparent'
          )}
        >
          {item.avatarUrl ? (
            <Image
              src={item.avatarUrl}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
            />
          ) : (
            <DefaultAvatar size={28} className="flex-shrink-0" />
          )}

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-fg-primary">
                {/* A nameless profile's `name` IS its handle, so printing both
                    lines gave two identical rows of hex — the most common shape
                    in the menu, since most accounts have no display name. Show
                    the handle once, in the position the eye reads first. */}
                {item.isAnonymous ? `@${item.username}` : item.name}
              </span>
              {item.isCat && (
                // `text-on-accent` rather than `text-white`: white on this
                // orange is 3.10:1 and fails AA (see tailwind.config.ts).
                <span className="flex-shrink-0 rounded-sm bg-accent-warm px-1.5 py-0.5 text-2xs font-medium uppercase tracking-caps text-on-accent">
                  AI
                </span>
              )}
            </span>
            {/* For a named profile the handle is always shown, including for the
                Cat: the point of the menu is that you learn `@cat` exists and
                can type it next time without opening anything. */}
            {!item.isAnonymous && (
              <span className="block truncate text-xs text-fg-tertiary">
                @{item.username}
                {item.isCat && ' · ask about this thread'}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

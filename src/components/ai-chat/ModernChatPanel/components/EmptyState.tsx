/**
 * EMPTY STATE — the Cat's turn, before the first message.
 *
 * One column, centred, in reading order:
 *
 *   greeting    — the person's name, so it is plainly THEIR Cat
 *   opener      — the one thing the Cat noticed, in its own voice, with the
 *                 replies that act on it and a quiet "not now"
 *   composer    — centred while the chat is empty, as in every assistant a
 *                 user already knows; it drops to the bottom on the first send
 *   chips       — three short things this person might ask
 *
 * It replaces a stack that said everything twice: a lead card whose "reason"
 * and "prompt" restated each other, written in the USER's voice ("Cat, help me
 * publish…"), a hint line, a swipe rail, and a memory counter — none of which
 * was the Cat speaking. What to say is decided server-side
 * (services/cat/prompt-suggestions); this file only lays it out.
 */

import type { ReactNode } from 'react';
import { Cat, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CAT_AGENT, CAT_HUB_COPY } from '@/config/cat-hub';
import { useAuth } from '@/hooks/useAuth';
import type { CatOpener } from '@/config/cat-prompts';

interface EmptyStateProps {
  opener: CatOpener | null;
  chips: string[];
  isLoadingSuggestions: boolean;
  onSuggestionClick: (suggestion: string) => void;
  onDismissOpener: (key: string) => void;
  isNewUser?: boolean;
  variant?: 'default' | 'focus';
  /** The composer, placed in the column (focus variant) instead of pinned below. */
  composer?: ReactNode;
}

/** Local time of day — the only honest thing a greeting can know without asking. */
export function greetingFor(date: Date, name?: string | null): string {
  const h = date.getHours();
  const part = h < 5 ? 'evening' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Good ${part}, ${first}` : `Good ${part}`;
}

export function EmptyState({
  opener,
  chips,
  isLoadingSuggestions,
  onSuggestionClick,
  onDismissOpener,
  isNewUser,
  variant = 'focus',
  composer,
}: EmptyStateProps) {
  const { profile } = useAuth();
  const isFocus = variant === 'focus';
  const title = isNewUser
    ? CAT_HUB_COPY.greetingNewUser
    : greetingFor(new Date(), profile?.name || profile?.username);

  return (
    <div className={cn('oc-chat-empty', !isFocus && 'py-10')}>
      <div className="oc-chat-home">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-fg-primary sm:text-3xl">
          {title}
        </h2>

        {isLoadingSuggestions ? (
          <div className="oc-chat-opener" aria-hidden="true">
            <span className="oc-chat-opener-mark" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3.5 w-4/5 animate-pulse rounded bg-surface-raised" />
              <div className="h-3.5 w-2/5 animate-pulse rounded bg-surface-raised" />
            </div>
          </div>
        ) : (
          opener && (
            <div className="oc-chat-opener" aria-live="polite">
              <span className="oc-chat-opener-mark" aria-hidden="true">
                <Cat className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-fg-primary">
                  <span className="sr-only">{CAT_AGENT.name}: </span>
                  {opener.say}
                </p>
                {opener.replies.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {opener.replies.map(reply => (
                      <button
                        key={reply}
                        type="button"
                        onClick={() => onSuggestionClick(reply)}
                        className="oc-chat-reply"
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismissOpener(opener.key)}
                className="-mr-1 -mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-fg-tertiary transition-colors hover:bg-surface-raised hover:text-fg-primary"
                aria-label="Not now"
                title="Not now"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        )}

        {composer}

        {!isLoadingSuggestions && chips.length > 0 && (
          <div className="oc-chat-chips" role="group" aria-label="Things to ask Cat">
            {chips.map(chip => (
              <button
                key={chip}
                type="button"
                onClick={() => onSuggestionClick(chip)}
                className="oc-chat-chip"
                title={chip}
              >
                {chip}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * EMPTY STATE — shown before the first message
 *
 * Suggestions arrive ranked, and at most the first carries a `reason`
 * (contract: @/config/cat-prompts). That single flag decides the layout:
 *
 *   reason present → the Cat has a recommendation. Render ONE lead with the
 *                    fact behind it, and demote the rest to quiet chips. The
 *                    reader has one thing to read and one obvious action.
 *   no reason      → the options are genuine equals (a new user choosing a
 *                    direction). Render them as an equal-weight fork.
 *
 * The old layout was four identical boxes in a 2×2 grid regardless — which
 * silently claimed all four were equally worth reading, and none of them said
 * why it was there.
 *
 * The demotion has to survive the phone, and it didn't: the "quiet chips" were
 * `inline-flex` inside a wrapping row, and every chip holds a whole sentence,
 * so each one wrapped to full width and the screen filled with four large
 * boxes again — the exact layout this file exists to avoid. They are now a
 * single-line horizontal rail you swipe, which is also what lets the pool
 * behind them (see services/cat/prompt-suggestions) be wider than the screen.
 */

import Link from 'next/link';
import { ArrowRight, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CAT_HUB_COPY } from '@/config/cat-hub';
import { ROUTES } from '@/config/routes';
import { useCatMemoryCount } from '@/hooks/useCatMemoryCount';
import type { CatPromptSuggestion } from '@/config/cat-prompts';

interface EmptyStateProps {
  suggestions: CatPromptSuggestion[];
  hasContext: boolean;
  isLoadingSuggestions: boolean;
  onSuggestionClick: (suggestion: string) => void;
  isNewUser?: boolean;
  variant?: 'default' | 'focus';
}

export function EmptyState({
  suggestions,
  hasContext: _hasContext,
  isLoadingSuggestions,
  onSuggestionClick,
  isNewUser,
  variant = 'focus',
}: EmptyStateProps) {
  const isFocus = variant === 'focus';
  const title = isNewUser ? CAT_HUB_COPY.greetingNewUser : CAT_HUB_COPY.greeting;
  const memoryCount = useCatMemoryCount();

  const [lead, ...rest] = suggestions;
  const recommendation = lead?.reason ? lead : null;
  const alternatives = recommendation ? rest : suggestions;

  return (
    <div className={cn('oc-chat-empty', !isFocus && 'py-12')}>
      <h2
        className={
          isFocus
            ? 'max-w-lg text-2xl font-semibold tracking-tight text-fg-primary sm:text-3xl'
            : 'mb-2 text-2xl font-semibold text-fg-primary'
        }
      >
        {title}
      </h2>
      {/* Hint is verbose on mobile and competes with the suggestion
          buttons, which already act as the hint. Show on >=sm only. */}
      <p className="mt-2 hidden max-w-md text-sm text-fg-secondary sm:block">
        {CAT_HUB_COPY.greetingHint}
      </p>

      {isLoadingSuggestions && (
        <div className="mt-8 flex w-full max-w-2xl flex-col gap-2">
          <div className="h-20 animate-pulse rounded-md bg-surface-raised" />
          <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-11 flex-1 animate-pulse rounded-lg bg-surface-raised" />
            ))}
          </div>
        </div>
      )}

      {!isLoadingSuggestions && suggestions.length > 0 && (
        <div className="mt-8 w-full max-w-2xl">
          {recommendation && (
            <button
              type="button"
              onClick={() => onSuggestionClick(recommendation.prompt)}
              className="oc-chat-lead"
            >
              <span className="oc-chat-lead-reason">{recommendation.reason}</span>
              <span className="oc-chat-lead-prompt">
                {recommendation.prompt}
                <ArrowRight className="h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden="true" />
              </span>
            </button>
          )}

          {alternatives.length > 0 && (
            <div
              className={cn(
                recommendation
                  ? 'oc-chat-suggestion-rail no-scrollbar mt-3'
                  : 'flex flex-col gap-2 sm:grid sm:grid-cols-2'
              )}
              // A rail is only discoverable if it announces itself as one.
              {...(recommendation
                ? { role: 'group' as const, 'aria-label': 'More things to ask Cat' }
                : {})}
            >
              {alternatives.map((suggestion, i) => (
                <button
                  key={`${i}-${suggestion.prompt}`}
                  type="button"
                  onClick={() => onSuggestionClick(suggestion.prompt)}
                  className={recommendation ? 'oc-chat-suggestion-quiet' : 'oc-chat-suggestion'}
                  title={recommendation ? suggestion.prompt : undefined}
                >
                  {suggestion.prompt}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {memoryCount > 0 && (
        <Link
          href={ROUTES.SETTINGS_AI}
          className="mt-6 inline-flex items-center gap-1.5 text-xs text-fg-tertiary transition-colors hover:text-fg-secondary"
        >
          <Brain className="h-3.5 w-3.5" />
          Cat remembers {memoryCount} thing{memoryCount === 1 ? '' : 's'} about you
        </Link>
      )}
    </div>
  );
}

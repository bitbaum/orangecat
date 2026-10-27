import { BrandMarkIcon } from '@/components/shell/BrandMarkIcon';
/**
 * The Cat's turn, before the first message — the words over chatkit's
 * starters (ChatApp `startersTitle`). In reading order:
 *
 *   greeting  — the person's name, so it is plainly THEIR Cat
 *   opener    — the one thing the Cat noticed, in its own voice, with a quiet
 *               "Not now"; its replies are the first starters under it
 *   links     — a suggestion that only opens a page is a link, not a message
 *
 * The starters themselves (the opener's replies, then three things this
 * person might ask) are chatkit's buttons, so a tap sends exactly as typing
 * does. What to say is decided server-side (services/cat/prompt-suggestions);
 * this file only lays it out.
 */

import Link from 'next/link';
import { X } from 'lucide-react';
import { CAT_AGENT, CAT_HUB_COPY } from '@/config/cat-hub';
import { getCreateSuggestionHref } from '@/config/cat-create-suggestions';
import { useAuth } from '@/hooks/useAuth';
import type { CatOpener } from '@/config/cat-prompts';

/** Local time of day — the only honest thing a greeting can know without asking. */
export function greetingFor(date: Date, name?: string | null): string {
  const h = date.getHours();
  const part = h < 5 ? 'evening' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Good ${part}, ${first}` : `Good ${part}`;
}

/** The suggestions that SAY something, for chatkit's starter buttons. */
export function catStarters(opener: CatOpener | null, chips: readonly string[]): string[] {
  const all = [...(opener?.replies ?? []), ...chips];
  return [...new Set(all)].filter(s => !getCreateSuggestionHref(s));
}

interface EmptyStateProps {
  opener: CatOpener | null;
  chips: readonly string[];
  isLoadingSuggestions: boolean;
  onDismissOpener: (key: string) => void;
  isNewUser?: boolean;
}

export function EmptyState({
  opener,
  chips,
  isLoadingSuggestions,
  onDismissOpener,
  isNewUser,
}: EmptyStateProps) {
  const { profile } = useAuth();
  const title = isNewUser
    ? CAT_HUB_COPY.greetingNewUser
    : greetingFor(new Date(), profile?.name || profile?.username);
  const links = [...(opener?.replies ?? []), ...chips].flatMap(s => {
    const href = getCreateSuggestionHref(s);
    return href ? [{ label: s, href }] : [];
  });

  return (
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
              <BrandMarkIcon size={16} />
            </span>
            <p className="mb-0 min-w-0 flex-1 text-sm leading-relaxed text-fg-primary">
              <span className="sr-only">{CAT_AGENT.name}: </span>
              {opener.say}
            </p>
            <button
              type="button"
              onClick={() => onDismissOpener(opener.key)}
              className="-mr-1 -mt-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-fg-tertiary transition-colors hover:bg-surface-raised hover:text-fg-primary"
              aria-label="Not now"
              title="Not now"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      )}

      {links.length > 0 && (
        <nav aria-label="Open a page" className="flex flex-col gap-2">
          {links.map(link => (
            <Link key={link.href} href={link.href} className="ck-starter">
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

'use client';

/**
 * Find the person as you type — the list under the "To" / "From" field.
 *
 * The field used to resolve an EXACT username after a pause, so typing "m"
 * asked the server whether someone is literally called m and printed
 * "Nobody goes by @m" (owner, 2026-10-21: "Request search is working or
 * not?"). A name is found, not spelled: this is the same typo-tolerant
 * search the ⌘K palette runs (@bitbaum/searchkit through /api/search),
 * narrowed to people. Tapping a row fills the field with the handle; the
 * exact check below the field then reads the person back as before.
 *
 * One anatomy per row: avatar, name, @handle. At most five rows.
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { getInitial } from '@/utils/string';

interface PeopleSuggestionsProps {
  /** What the person typed. Searched from two characters. */
  query: string;
  /** False once a row was picked or the text is not a name (an address, an invoice). */
  enabled: boolean;
  onPick: (handle: string) => void;
}

const MAX_ROWS = 5;

export function PeopleSuggestions({ query, enabled, onPick }: PeopleSuggestionsProps) {
  const q = query.trim().replace(/^@/, '');
  const { results } = useGlobalSearch(q, enabled && q.length >= 2, 12);
  const people = results
    .filter(hit => hit.type === 'profile' && hit.handle)
    // The one already typed in full is not a suggestion.
    .filter(hit => hit.handle!.toLowerCase() !== q.toLowerCase())
    .slice(0, MAX_ROWS);

  if (!enabled || people.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label="People"
      className="divide-y divide-subtle overflow-hidden rounded-lg border border-subtle bg-surface-base"
    >
      {people.map(hit => (
        <li key={hit.id}>
          <button
            type="button"
            onClick={() => onPick(hit.handle as string)}
            className="flex min-h-12 w-full items-center gap-3 px-3 text-left hover:bg-surface-raised"
          >
            <Avatar className="h-8 w-8">
              {hit.imageUrl && <AvatarImage src={hit.imageUrl} alt="" />}
              <AvatarFallback className="text-sm font-medium text-fg-secondary">
                {getInitial(hit.title)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-fg-primary">{hit.title}</span>
              <span className="block truncate text-sm text-fg-secondary">@{hit.handle}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

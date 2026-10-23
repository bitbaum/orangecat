'use client';

/**
 * The people under the "To" / "From" field — one anatomy per row: avatar,
 * name, @handle, and on the right why they are here (Following, Follows
 * you). Tapping a row fills the field with the handle; the exact check under
 * the field then reads the person back.
 *
 * What is listed comes from usePeopleFinder: the circle before a letter is
 * typed, everyone with a handle after. The shared search was not enough —
 * it lists a profile only once it has a bio or a picture, and the person you
 * followed this morning has neither (owner, 2026-10-22: "I'm following
 * another person. She's not popping up").
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PEOPLE_COPY } from '@/config/people';
import type { FoundPerson } from '@/domain/people/rankPeople';
import { getInitial } from '@/utils/string';

interface PeoplePickerProps {
  people: readonly FoundPerson[];
  onPick: (handle: string) => void;
}

export function PeoplePicker({ people, onPick }: PeoplePickerProps) {
  if (people.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label={PEOPLE_COPY.listLabel}
      className="divide-y divide-subtle overflow-hidden rounded-lg border border-subtle bg-surface-base"
    >
      {people.map(person => {
        const why = PEOPLE_COPY.relation[person.relation];
        return (
          <li key={person.id}>
            <button
              type="button"
              onClick={() => onPick(person.username)}
              className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-raised"
            >
              <Avatar className="h-9 w-9">
                {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" />}
                <AvatarFallback className="text-sm font-medium text-fg-secondary">
                  {getInitial(person.name ?? person.username)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                {/* A person with no name yet has only their handle: say it once. */}
                <span className="block truncate font-medium leading-tight text-fg-primary">
                  {person.name ?? `@${person.username}`}
                </span>
                {person.name && (
                  <span className="mt-0.5 block truncate text-sm leading-tight text-fg-secondary">
                    @{person.username}
                  </span>
                )}
              </span>
              {why && <span className="shrink-0 text-xs text-fg-tertiary">{why}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

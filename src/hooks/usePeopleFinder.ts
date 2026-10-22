'use client';

/**
 * The people under a "To" / "From" field, as the person types.
 *
 * Before anything is typed: the circle (who you follow, who follows you,
 * who you have asked or been asked by), read once. From the first letter the
 * circle is filtered on the spot and the server is asked for everyone else;
 * its answer replaces the local list when it arrives (@bitbaum/searchkit's
 * hook drops a late answer to an older query). The handle typed in full is
 * not a suggestion.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchAsYouType } from '@bitbaum/searchkit/react';
import { PEOPLE_FIND_LIMIT, PEOPLE_LIST_ROWS } from '@/config/people';
import { rankPeople, startsPerson, type FoundPerson } from '@/domain/people/rankPeople';
import { fetchPeople, type PeopleFound } from '@/services/people/people-client';

export interface PeopleFinder {
  people: FoundPerson[];
  loading: boolean;
}

const EMPTY: FoundPerson[] = [];

export function usePeopleFinder(query: string, enabled: boolean): PeopleFinder {
  const q = query.trim().replace(/^@/, '');
  const [circle, setCircle] = useState<FoundPerson[] | null>(null);

  useEffect(() => {
    if (!enabled || circle !== null) {
      return;
    }
    let live = true;
    fetchPeople('', PEOPLE_FIND_LIMIT)
      .then(found => live && setCircle(found.people))
      .catch(() => live && setCircle(EMPTY));
    return () => {
      live = false;
    };
  }, [enabled, circle]);

  const run = useCallback(
    (text: string, signal: AbortSignal): Promise<PeopleFound> =>
      fetchPeople(text, PEOPLE_FIND_LIMIT, signal),
    []
  );
  const typed = useSearchAsYouType(q, run, { enabled: enabled && q.length > 0, minLength: 1 });

  const people = useMemo(() => {
    if (!enabled) {
      return EMPTY;
    }
    const known = circle ?? EMPTY;
    const base =
      q === ''
        ? known
        : typed.results && typed.results.query === q
          ? typed.results.people
          : rankPeople(
              q,
              known.filter(p => startsPerson(p, q))
            );
    return base
      .filter(p => p.username.toLowerCase() !== q.toLowerCase())
      .slice(0, PEOPLE_LIST_ROWS);
  }, [enabled, circle, q, typed.results]);

  return { people, loading: typed.loading };
}

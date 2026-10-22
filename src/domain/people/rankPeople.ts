/**
 * Ranking the people a finder returned — pure, so the browser can run the
 * same rule on the circle it already holds while the server answers.
 */

import { rerank } from '@bitbaum/searchkit';
import { PERSON_RELATION_WEIGHT, type PersonRelation } from '@/config/people';

export interface FoundPerson {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  relation: PersonRelation;
}

const weight = (p: FoundPerson) => PERSON_RELATION_WEIGHT[p.relation];
const shown = (p: FoundPerson) => p.name?.trim() || p.username;

/** Does a typed fragment start a word of the name, or the handle? */
export function startsPerson(person: FoundPerson, typed: string): boolean {
  const needle = typed.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  if (person.username.toLowerCase().startsWith(needle)) {
    return true;
  }
  return (person.name ?? '')
    .toLowerCase()
    .split(/\s+/)
    .some(word => word.startsWith(needle));
}

/**
 * Nothing typed: the circle, closest relation first, then by name. Something
 * typed: searchkit ranks the text (typos, whole words, name before handle),
 * the relation breaks ties, and a row the ranker cannot place stays only when
 * the fragment sits inside the name or handle — which is why the database
 * returned it.
 */
export function rankPeople(query: string, people: readonly FoundPerson[]): FoundPerson[] {
  const typed = query.trim().replace(/^@/, '');
  if (!typed) {
    return [...people].sort((a, b) => weight(b) - weight(a) || shown(a).localeCompare(shown(b)));
  }
  const needle = typed.toLowerCase();
  return rerank(
    people,
    {
      fields: [
        { name: 'name', get: p => p.name },
        { name: 'username', get: p => p.username },
      ],
      rank: weight,
    },
    typed
  )
    .filter(
      ({ item, hit }) =>
        hit !== null || `${item.name ?? ''} ${item.username}`.toLowerCase().includes(needle)
    )
    .map(({ item }) => item);
}

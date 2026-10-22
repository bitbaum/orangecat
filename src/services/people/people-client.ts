/**
 * Browser client for /api/people — the list under "To" and "From".
 */

import { API_ROUTES } from '@/config/api-routes';
import type { FoundPerson } from '@/domain/people/rankPeople';

export type { FoundPerson };

export interface PeopleFound {
  /** What was asked, so a late answer to an older query is recognisable. */
  query: string;
  people: FoundPerson[];
}

export async function fetchPeople(
  query: string,
  limit: number,
  signal?: AbortSignal
): Promise<PeopleFound> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await fetch(`${API_ROUTES.PEOPLE}?${params}`, { signal, credentials: 'same-origin' });
  if (!res.ok) {
    return { query: query.trim(), people: [] };
  }
  const body = (await res.json()) as { data?: PeopleFound };
  return body.data ?? { query: query.trim(), people: [] };
}

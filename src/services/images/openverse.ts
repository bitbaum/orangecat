/**
 * Openverse image search — free, no API key, Creative-Commons licensed images.
 * We default to CC0 + Public-Domain-Mark so a chosen image needs no attribution
 * (there's no caption slot on an article cover), which keeps reuse legally clean.
 * Returns [] only when Openverse answered and found nothing. When it did not
 * answer (an error status, a timeout, a network failure) it throws
 * `ImageSearchUnavailableError`: an outage used to read as "No images found.
 * Try a different search term", which sent writers re-typing words into a
 * search that was down (measured 2026-11-13: anonymous image searches with
 * page_size > 1 answered 504 after 8-15 s, while /v1/ and /v1/audio/ were up).
 *
 * Why Openverse (not a paid generator): the whole AI-writing surface runs on the
 * free pool and touches no credits; image help should stay the same — zero cost,
 * zero new secrets.
 */

import type { StockImage } from './types';
import { logger } from '@/utils/logger';

const OPENVERSE_URL = 'https://api.openverse.org/v1/images/';
/** CC0 + Public Domain Mark — reusable commercially, no attribution required. */
const LICENSE_FILTER = 'cc0,pdm';
/**
 * Longer than a healthy answer (well under a second) and shorter than the
 * 15 s an overloaded Openverse takes to give up, so the writer hears "down"
 * instead of watching a spinner.
 */
const OPENVERSE_TIMEOUT_MS = 10_000;

/** Openverse did not answer; distinct from "answered with no matches". */
export class ImageSearchUnavailableError extends Error {
  constructor(readonly status?: number) {
    super(status ? `Openverse answered ${status}` : 'Openverse did not answer');
    this.name = 'ImageSearchUnavailableError';
  }
}

interface OpenverseResult {
  id?: string;
  title?: string;
  url?: string;
  thumbnail?: string;
  creator?: string | null;
  license?: string;
  foreign_landing_url?: string | null;
}

export async function searchOpenverse(query: string, count = 8): Promise<StockImage[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }
  const params = new URLSearchParams({
    q,
    license: LICENSE_FILTER,
    page_size: String(Math.min(Math.max(count, 1), 20)),
    mature: 'false',
  });
  let res: Response;
  try {
    res = await fetch(`${OPENVERSE_URL}?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'OrangeCat/1.0 (+https://orangecat.ch)',
      },
      // Openverse results are stable; cache briefly to spare their rate limit.
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(OPENVERSE_TIMEOUT_MS),
    });
  } catch (err) {
    logger.warn('openverse: search did not answer', { err: String(err) }, 'Openverse');
    throw new ImageSearchUnavailableError();
  }
  if (!res.ok) {
    logger.warn('openverse: search failed', { status: res.status }, 'Openverse');
    throw new ImageSearchUnavailableError(res.status);
  }
  let json: { results?: OpenverseResult[] };
  try {
    json = (await res.json()) as { results?: OpenverseResult[] };
  } catch (err) {
    logger.warn('openverse: unreadable answer', { err: String(err) }, 'Openverse');
    throw new ImageSearchUnavailableError(res.status);
  }
  return (json.results ?? [])
    .filter(r => r.id && r.url && r.thumbnail)
    .map((r): StockImage => ({
      id: r.id as string,
      thumbUrl: r.thumbnail as string,
      fullUrl: r.url as string,
      title: (r.title || 'Untitled').slice(0, 120),
      creator: r.creator ?? null,
      license: r.license || 'cc0',
      sourceUrl: r.foreign_landing_url ?? null,
    }));
}

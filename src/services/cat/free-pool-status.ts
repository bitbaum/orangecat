/**
 * The free pool, said truthfully — what GET /api/cat/capacity knows, as tiles
 * a person can read.
 *
 * Every reading here is learned from a live response and held in memory, so
 * "no reading" is the normal state after a deploy, and it must never be
 * dressed up as good news. The card used to print "nothing used yet — full
 * allowance available" whenever the server simply had not seen a Groq
 * response yet — beside a budget card saying the person had already sent a
 * message that day. Not knowing is said as not knowing.
 *
 * Three things the old tiles claimed and this module does not:
 *
 *   - A per-minute token count. It is stale within the minute it is read, and
 *     nothing a person can act on: Cat trims its prompt to fit and retries.
 *   - A Groq "resets in 1m 26s". Groq's daily request bucket refills on a
 *     rolling clock; the header names when the NEXT request comes back, which
 *     read as "the whole allowance is back in a minute and a half".
 *   - Healthy headers as health. Groq's tokens-per-day pool is reported only
 *     in the body of the refusal that enforces it, so a model whose daily pool
 *     is known spent reads "Used up" whatever its headers said.
 *
 * Pure: no fetch, no clock beyond `now`.
 */

import type { CatCapacityResponse } from '@/app/api/cat/capacity/route';
import { formatCountdownCoarse } from '@/utils/countdown';

export interface FreePoolTile {
  id: 'groq' | 'openrouter';
  label: string;
  value: string;
  detail: string;
}

/** "14:02 UTC" — the reading's age, so a number is never older than it looks. */
function utcClock(iso: string): string {
  return new Date(iso).toISOString().slice(11, 16) + ' UTC';
}

function compact(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

export function freePoolTiles(data: CatCapacityResponse, now: Date = new Date()): FreePoolTile[] {
  const openrouterOpen = data.openrouter.configured && !data.openrouter.freeDailyCapHitAt;
  const groqModel = data.groq.models.find(m => m.model === data.promptBudget.model) ?? null;
  const obs = groqModel?.observation ?? null;

  let groq: FreePoolTile;
  if (!data.groq.configured) {
    groq = { id: 'groq', label: 'Groq', value: 'Not set up', detail: 'not part of the pool here' };
  } else if (groqModel?.dailyPoolSpent || obs?.remainingRequests === 0) {
    groq = {
      id: 'groq',
      label: 'Groq',
      value: 'Used up for now',
      detail: openrouterOpen
        ? 'Cat answers on the OpenRouter free models meanwhile'
        : 'its allowance refills through the day',
    };
  } else if (obs && obs.remainingRequests !== null && obs.limitRequests !== null) {
    groq = {
      id: 'groq',
      label: 'Groq',
      value: `${compact(obs.remainingRequests)} / ${compact(obs.limitRequests)}`,
      detail: `requests left today, as of ${utcClock(obs.observedAt)}`,
    };
  } else {
    groq = {
      id: 'groq',
      label: 'Groq',
      value: 'No reading yet',
      detail: "Groq reports what's left with each reply — it shows here after Cat's next one",
    };
  }

  let openrouter: FreePoolTile;
  if (!data.openrouter.configured) {
    openrouter = {
      id: 'openrouter',
      label: 'OpenRouter free models',
      value: 'Not set up',
      detail: 'not part of the pool here',
    };
  } else if (data.openrouter.freeResetsAt) {
    const seconds = Math.max(
      60,
      Math.round((new Date(data.openrouter.freeResetsAt).getTime() - now.getTime()) / 1000)
    );
    openrouter = {
      id: 'openrouter',
      label: 'OpenRouter free models',
      value: 'Used up today',
      detail: `back at 00:00 UTC, in ${formatCountdownCoarse(seconds)}`,
    };
  } else {
    openrouter = {
      id: 'openrouter',
      label: 'OpenRouter free models',
      // "Available" overclaimed: all the server knows is that it has not been
      // refused today. Say exactly that.
      value: 'Not refused today',
      detail: 'the fallback when Groq is out · refills at 00:00 UTC',
    };
  }

  return [groq, openrouter];
}

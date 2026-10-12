/**
 * The free-pool tiles (services/cat/free-pool-status.ts).
 *
 * The property under test: not knowing is said as not knowing. The card used
 * to print "nothing used yet — full allowance available" for a server that had
 * simply not seen a Groq response since it started, and "Available" for an
 * OpenRouter pool it had only not been refused by.
 */

import { freePoolTiles } from '@/services/cat/free-pool-status';
import type { CatCapacityResponse } from '@/app/api/cat/capacity/route';
import type { GroqRateLimitObservation } from '@/services/ai/groq-capacity';

const NOW = new Date('2026-10-12T13:10:00Z');
const MODEL = 'openai/gpt-oss-120b';

function capacity(
  over: {
    groqConfigured?: boolean;
    observation?: GroqRateLimitObservation | null;
    dailyPoolSpent?: boolean;
    openrouterConfigured?: boolean;
    freeResetsAt?: string | null;
  } = {}
): CatCapacityResponse {
  return {
    groq: {
      configured: over.groqConfigured ?? true,
      models: [
        {
          model: MODEL,
          tpmLimit: 8000,
          observation: over.observation ?? null,
          dailyPoolSpent: over.dailyPoolSpent ?? false,
        },
      ],
    },
    openrouter: {
      configured: over.openrouterConfigured ?? true,
      freeDailyCapHitAt: over.freeResetsAt ? '2026-10-12T09:00:00Z' : null,
      freeResetsAt: over.freeResetsAt ?? null,
    },
    quota: { dailyLimit: 10, dailyRequests: 1, requestsRemaining: 9, resetInSeconds: 39_000 },
    promptBudget: { model: MODEL, tpmLimit: 8000, replyReserveTokens: 1024, budgetTokens: 6826 },
    asOf: NOW.toISOString(),
  };
}

const observation = (over: Partial<GroqRateLimitObservation> = {}): GroqRateLimitObservation => ({
  model: MODEL,
  limitRequests: 1000,
  remainingRequests: 942,
  limitTokens: 8000,
  remainingTokens: 7900,
  resetRequestsSeconds: 86,
  resetTokensSeconds: 1,
  retryAfterSeconds: null,
  observedAt: '2026-10-12T12:58:00Z',
  ...over,
});

const tile = (data: CatCapacityResponse, id: 'groq' | 'openrouter') =>
  freePoolTiles(data, NOW).find(t => t.id === id)!;

describe('freePoolTiles — Groq', () => {
  it('says it has no reading, never that nothing was used', () => {
    const groq = tile(capacity(), 'groq');
    expect(groq.value).toBe('No reading yet');
    expect(`${groq.value} ${groq.detail}`).not.toMatch(/nothing used|full allowance/i);
  });

  it('shows the count with the time it was read, and no rolling-reset countdown', () => {
    const groq = tile(capacity({ observation: observation() }), 'groq');
    expect(groq.value).toBe('942 / 1.0k');
    expect(groq.detail).toBe('requests left today, as of 12:58 UTC');
    expect(groq.detail).not.toMatch(/resets in/);
  });

  it('a spent daily token pool reads as used up, whatever the headers say', () => {
    const groq = tile(capacity({ observation: observation(), dailyPoolSpent: true }), 'groq');
    expect(groq.value).toBe('Used up for now');
    expect(groq.detail).toMatch(/OpenRouter/);
  });

  it('does not point at OpenRouter when OpenRouter is out too', () => {
    const groq = tile(
      capacity({ dailyPoolSpent: true, freeResetsAt: '2026-10-13T00:00:00Z' }),
      'groq'
    );
    expect(groq.detail).not.toMatch(/OpenRouter/);
  });

  it('says so when Groq is not part of the pool', () => {
    expect(tile(capacity({ groqConfigured: false }), 'groq').value).toBe('Not set up');
  });
});

describe('freePoolTiles — OpenRouter', () => {
  it('claims only what it knows: not refused today', () => {
    const or = tile(capacity(), 'openrouter');
    expect(or.value).toBe('Not refused today');
    expect(or.value).not.toBe('Available');
  });

  it('a hit daily cap says when it comes back', () => {
    const or = tile(capacity({ freeResetsAt: '2026-10-13T00:00:00Z' }), 'openrouter');
    expect(or.value).toBe('Used up today');
    expect(or.detail).toBe('back at 00:00 UTC, in 10h 50m');
  });
});

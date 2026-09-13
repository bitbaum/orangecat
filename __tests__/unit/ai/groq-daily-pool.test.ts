/**
 * Groq meters a daily token pool it never puts in a header.
 *
 * Tokens-per-minute and requests-per-day arrive as `x-ratelimit-*`. A third
 * limit — tokens per DAY — is stated once, in prose, inside the body of the 429
 * that enforces it. So every header can read healthy through a total outage:
 * measured on FleetCrown production 2026-09-13, the headers said 999 of 1000
 * requests remained while every call was refused and users got 503s.
 *
 * OrangeCat threw that body away — `new GroqAPIError('Rate limit exceeded')`
 * discarded the one sentence that names the pool. Reading it lets the
 * pre-flight stop dialling a model whose day is gone instead of paying a
 * guaranteed 429 on every message for the hours until it resets.
 *
 * The bodies below are Groq's real wording, not invented.
 */
import {
  recordGroqRefusal,
  isGroqDailyPoolSpent,
  resetGroqDailyPool,
} from '@/services/ai/groq-capacity';

const TPD_REFUSAL =
  'Rate limit reached for model `openai/gpt-oss-20b` in organization `org_01jy` ' +
  'service tier `on_demand` on tokens per day (TPD): Limit 200000, Used 199773, ' +
  'Requested 571. Please try again in 2m28.608s.';

const TPM_REFUSAL =
  'Rate limit reached for model `openai/gpt-oss-20b` in organization `org_01jy` ' +
  'service tier `on_demand` on tokens per minute (TPM): Limit 8000, Used 7900, ' +
  'Requested 500. Please try again in 7.66s.';

const MODEL = 'openai/gpt-oss-20b';

beforeEach(() => resetGroqDailyPool());
afterEach(() => resetGroqDailyPool());

describe('the limit only the refusal admits to', () => {
  it('reads the daily pool out of the 429 body', () => {
    const reading = recordGroqRefusal(MODEL, TPD_REFUSAL, 149);
    expect(reading).not.toBeNull();
    expect(reading?.window).toBe('day');
    expect(reading?.limit).toBe(200000);
    // The refusal names what was USED, not what is left.
    expect(reading?.remaining).toBe(200000 - 199773);
  });

  it('stands the model down on a day-window refusal even with tokens "left"', () => {
    // The case that disproved the first draft, which required remaining === 0.
    // FleetCrown's real refusal said "Limit 200000, Used 199773" — 227 tokens
    // left, and every call refused, because no real request fits in 227 tokens.
    // The vendor has just declined a live request, so the day IS spent.
    recordGroqRefusal(MODEL, TPD_REFUSAL, 149);
    expect(isGroqDailyPoolSpent(MODEL)).toBe(true);
  });

  it('does NOT stand a model down for a per-minute limit', () => {
    // The distinction that matters. A busy second must not sideline a healthy
    // model for the rest of the day — the chain's ordinary retry handles TPM.
    const reading = recordGroqRefusal(MODEL, TPM_REFUSAL, 8);
    expect(reading).toBeNull();
    expect(isGroqDailyPoolSpent(MODEL)).toBe(false);
  });

  it('ignores a body that names no numbers', () => {
    for (const body of ['Rate limit exceeded', '', null, undefined]) {
      expect(recordGroqRefusal(MODEL, body as string | null, null)).toBeNull();
    }
    expect(isGroqDailyPoolSpent(MODEL)).toBe(false);
  });

  it('treats a model never refused as available, not as spent', () => {
    // "Never asked" is a third state. Guessing "spent" would drop a working
    // model out of the chain on no evidence at all.
    expect(isGroqDailyPoolSpent('some/model-we-never-called')).toBe(false);
  });

  it('lets the model back in once the reset time passes', () => {
    const t0 = Date.now();
    recordGroqRefusal(MODEL, TPD_REFUSAL, 60, t0);

    expect(isGroqDailyPoolSpent(MODEL, t0 + 30_000)).toBe(true);
    expect(isGroqDailyPoolSpent(MODEL, t0 + 61_000)).toBe(false);
  });

  it('stands down only the model that was refused', () => {
    // The pool is org-wide, but the refusal names one model and the skip is
    // applied per link. Standing down a model we have no refusal for would be
    // inventing evidence.
    recordGroqRefusal(MODEL, TPD_REFUSAL, 60);
    expect(isGroqDailyPoolSpent(MODEL)).toBe(true);
    expect(isGroqDailyPoolSpent('qwen/qwen3.8-27b')).toBe(false);
  });
});

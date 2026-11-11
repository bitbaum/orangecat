/**
 * A failed turn says when the shared pool is back, when that is known.
 *
 * Seen on production 2026-11-11: a brand-new account's first message to the
 * Cat failed down the whole chain because the shared daily pool was spent, and
 * the screen said "this is usually momentary. Try again". Every retry failed
 * the same way for most of an hour, and the refusal had already named the time.
 */
import { recordGroqRefusal, resetGroqDailyPool } from '@/services/ai/groq-capacity';
import { allProvidersDownMessage } from '@/services/cat/chat-orchestrator';

const TPD_REFUSAL =
  'Rate limit reached for model `openai/gpt-oss-20b` in organization `org_01jy` ' +
  'service tier `on_demand` on tokens per day (TPD): Limit 200000, Used 199773, ' +
  'Requested 571. Please try again in 47m20s.';

const NOW = 1_800_000_000_000;

beforeEach(() => resetGroqDailyPool());
afterEach(() => resetGroqDailyPool());

describe('allProvidersDownMessage', () => {
  it('keeps the momentary sentence when no pool is known to be spent', () => {
    expect(allProvidersDownMessage(NOW)).toContain('usually momentary');
  });

  it('names the wait once a refusal has said the daily pool is spent', () => {
    recordGroqRefusal('openai/gpt-oss-20b', TPD_REFUSAL, 2840, NOW);
    const message = allProvidersDownMessage(NOW);
    expect(message).not.toContain('momentary');
    expect(message).toMatch(/back in about 4[78] minutes/);
    expect(message).toContain('Settings → AI');
  });

  it('speaks in hours for a long wait and goes back to normal after it', () => {
    recordGroqRefusal('openai/gpt-oss-20b', TPD_REFUSAL, 3 * 3600, NOW);
    expect(allProvidersDownMessage(NOW)).toContain('about 3 hours');
    expect(allProvidersDownMessage(NOW + 4 * 3600_000)).toContain('usually momentary');
  });
});

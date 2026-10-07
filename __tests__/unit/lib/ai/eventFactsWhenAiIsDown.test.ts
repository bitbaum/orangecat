/**
 * "Fill with AI" on the event form, 2026-10-07: the AI service did not respond
 * and the form stayed empty behind a red notice — the date, the price and the
 * place the person had just typed included. The words carry those facts; the
 * model's part is a title and a description. So a silent model fills the
 * facts and says what is missing, and an answering model never gets to
 * overrule "19:00" or "1 CHF".
 */
import { generateFormPrefill, FACTS_ONLY_NOTICE } from '@/lib/ai/form-prefill-service';
import { resolveAiAssistTarget } from '@/lib/ai/assist-target';
import { callPlatformJson } from '@/services/cat/platform-llm';

vi.mock('@/services/cat/platform-llm', () => ({
  callPlatformJson: vi.fn(),
  hasPlatformProviders: () => true,
}));
vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const mocked = callPlatformJson as unknown as ReturnType<typeof vi.fn>;
const target = resolveAiAssistTarget('event')!;
const context = {
  now: new Date('2026-10-07T11:10:00Z'),
  zone: 'Europe/Zurich',
  currency: 'CHF' as const,
};
const words = 'Konzert heute Abend in der Roten Fabrik. Beginn: 19:00 Uhr. Eintritt: 1 CHF.';

describe('event prefill when the model is silent', () => {
  beforeEach(() => mocked.mockReset());

  it('fills the facts, keeps the words as title and description, and says so', async () => {
    mocked.mockResolvedValue(null);
    const r = await generateFormPrefill({ target, description: words, context });
    expect(r.success).toBe(true);
    expect(r.notice).toBe(FACTS_ONLY_NOTICE);
    expect(r.data).toMatchObject({
      title: 'Konzert heute Abend in der Roten Fabrik',
      description: words,
      start_date: '2026-10-07T19:00',
      timezone: 'Europe/Zurich',
      venue_name: 'Roten Fabrik',
      ticket_price: 1,
      is_free: false,
      currency: 'CHF',
      event_type: 'concert',
      category: 'Music',
    });
    expect(r.confidence.start_date).toBe(1);
  });

  it('still fails honestly when the words carry no facts', async () => {
    mocked.mockResolvedValue(null);
    const r = await generateFormPrefill({ target, description: 'something nice soon', context });
    expect(r.success).toBe(false);
    expect(r.code).toBe('provider_unavailable');
  });

  it('a model that answers adds the prose but never overrules a stated fact', async () => {
    mocked.mockResolvedValue(
      JSON.stringify({
        data: {
          title: 'Live-Konzert – Rote Fabrik',
          description: 'Ein Abend mit Live-Musik.',
          start_date: '2026-10-08T20:00',
          ticket_price: 10,
          event_type: 'party',
        },
        confidence: {},
      })
    );
    const r = await generateFormPrefill({ target, description: words, context });
    expect(r.success).toBe(true);
    expect(r.notice).toBeUndefined();
    expect(r.data).toMatchObject({
      title: 'Live-Konzert – Rote Fabrik',
      start_date: '2026-10-07T19:00',
      ticket_price: 1,
      event_type: 'concert',
    });
    // The model was told what day it is.
    const prompt = String(mocked.mock.calls[0][1]);
    expect(prompt).toContain('today is Wednesday 2026-10-07 in Europe/Zurich');
  });
});

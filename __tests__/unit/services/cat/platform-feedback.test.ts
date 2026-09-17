/**
 * Public Ask-Cat / feedback loop (platform-feedback.ts).
 *
 * Pins the three contracts the /feedback page depends on:
 *  - a question gets Cat's answer AND the exchange is stored ('answered'),
 *  - with no platform LLM the message is still stored ('new') and the caller
 *    can show the "team has it" fallback instead of an error,
 *  - past interactions — especially human resolution notes — are fed back
 *    into the prompt, which is the learning loop on customer interactions.
 */

import { answerAndRecordFeedback } from '@/services/cat/platform-feedback';
import { callPlatformJson } from '@/services/cat/platform-llm';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/services/cat/platform-llm', async () => {
  const actual = await vi.importActual('@/services/cat/platform-llm');
  return { ...actual, callPlatformJson: vi.fn() };
});

const mockCall = callPlatformJson as Mock;

interface RecallRow {
  message: string;
  cat_answer: string | null;
  resolution_note: string | null;
}

/**
 * Chainable supabase mock for the two query shapes the service uses:
 * recall (select→in→order→limit resolves) and insert (insert→select→single
 * resolves). Captures inserted rows for assertions.
 */
function mockSupabase(opts: {
  recallRows?: RecallRow[];
  recallError?: { message: string } | null;
  insertResult?: { data: { id: string } | null; error: { message: string } | null };
}) {
  const inserts: Record<string, unknown>[] = [];
  const client = {
    from() {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'in', 'order', 'eq']) {
        chain[m] = () => chain;
      }
      chain.limit = () =>
        Promise.resolve({ data: opts.recallRows ?? [], error: opts.recallError ?? null });
      chain.insert = (row: Record<string, unknown>) => {
        inserts.push(row);
        return chain;
      };
      chain.single = () =>
        Promise.resolve(opts.insertResult ?? { data: { id: 'fb-1' }, error: null });
      return chain;
    },
  };
  return { client: client as never, inserts };
}

beforeEach(() => {
  mockCall.mockReset();
});

describe('answerAndRecordFeedback', () => {
  it('answers a question and stores the exchange as answered', async () => {
    mockCall.mockResolvedValue(
      JSON.stringify({ kind: 'question', answer: 'Signing up is free — head to /auth.' })
    );
    const { client, inserts } = mockSupabase({});

    const result = await answerAndRecordFeedback(client, {
      message: 'Is OrangeCat free to use?',
      email: 'visitor@example.com',
      pagePath: '/feedback',
    });

    expect(result.answer).toBe('Signing up is free — head to /auth.');
    expect(result.kind).toBe('question');
    expect(result.id).toBe('fb-1');
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      message: 'Is OrangeCat free to use?',
      email: 'visitor@example.com',
      kind: 'question',
      status: 'answered',
      cat_answer: 'Signing up is free — head to /auth.',
    });
    expect(inserts[0].answered_at).toBeTruthy();
  });

  it('still stores the message when the platform LLM is unavailable', async () => {
    mockCall.mockResolvedValue(null);
    const { client, inserts } = mockSupabase({});

    const result = await answerAndRecordFeedback(client, {
      message: 'The signup button is broken on my phone',
    });

    expect(result.answer).toBeNull();
    expect(result.kind).toBe('feedback'); // heuristic: no question mark, statement form
    expect(inserts[0]).toMatchObject({ status: 'new', cat_answer: null, answered_at: null });
  });

  it('classifies an unanswered question by heuristic', async () => {
    mockCall.mockResolvedValue(null);
    const { client } = mockSupabase({});

    const result = await answerAndRecordFeedback(client, {
      message: 'How do I receive Lightning payments',
    });

    expect(result.kind).toBe('question');
  });

  it('feeds related past interactions and team corrections back into the prompt', async () => {
    mockCall.mockResolvedValue(JSON.stringify({ kind: 'question', answer: 'ok' }));
    const { client } = mockSupabase({
      recallRows: [
        {
          message: 'Can I pay with PayPal on OrangeCat?',
          cat_answer: 'Only Bitcoin and Lightning are live today.',
          resolution_note: 'Correct — never promise fiat rails.',
        },
        { message: 'Totally unrelated bakery story', cat_answer: 'nice', resolution_note: null },
      ],
    });

    await answerAndRecordFeedback(client, { message: 'Does OrangeCat support PayPal payments?' });

    const userPrompt = mockCall.mock.calls[0][1] as string;
    expect(userPrompt).toContain('PAST CUSTOMER INTERACTIONS');
    expect(userPrompt).toContain('Can I pay with PayPal on OrangeCat?');
    expect(userPrompt).toContain(
      'Team correction (authoritative): Correct — never promise fiat rails.'
    );
    expect(userPrompt).not.toContain('bakery story');
  });

  it('returns the answer even when storing the exchange fails', async () => {
    mockCall.mockResolvedValue(JSON.stringify({ kind: 'question', answer: 'Here is help.' }));
    const { client } = mockSupabase({
      insertResult: { data: null, error: { message: 'relation does not exist' } },
    });

    const result = await answerAndRecordFeedback(client, { message: 'What is OrangeCat?' });

    expect(result.answer).toBe('Here is help.');
    expect(result.id).toBeNull();
  });

  it('survives a failed recall query (missing table) and still answers', async () => {
    mockCall.mockResolvedValue(JSON.stringify({ kind: 'feedback', answer: 'Thanks, noted.' }));
    const { client } = mockSupabase({ recallError: { message: 'relation does not exist' } });

    const result = await answerAndRecordFeedback(client, { message: 'Dark mode please!' });

    expect(result.answer).toBe('Thanks, noted.');
    const userPrompt = mockCall.mock.calls[0][1] as string;
    expect(userPrompt).not.toContain('PAST CUSTOMER INTERACTIONS');
  });
});

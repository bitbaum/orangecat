/**
 * Capability is OBSERVED, and the observation has to be remembered.
 *
 * Without memory, a tool-incapable model that we hold credentials for is
 * permanently verbless. Every turn: the plan is optimistic (`unobserved` means
 * ASK, per ADR-0008 D1), so definitions go out AND the prose action catalogue
 * is dropped because `actionsVia: 'tools'` means "definitions replace it" —
 * then the vendor rejects the definitions. Cat ends the turn unable to act
 * through the loop and no longer told how to act in prose. Forever.
 *
 * One recorded refusal has to end that, and only a refusal that actually NAMES
 * tools may count — a 429 or a context overflow must leave a capable model
 * capable.
 */
import {
  observedToolVerdict,
  recordToolAttempt,
  toolPlanForModel,
  actionsViaForModel,
  __resetObservationsForTest,
} from '@/services/cat/tool-capability';

const MODEL = 'some-vendor/uncatalogued-model';
const KEY = 'sk-a-users-own-key';

beforeEach(() => __resetObservationsForTest());

describe('before anything has been observed', () => {
  it('is a third state, not a denial', () => {
    expect(observedToolVerdict(MODEL, KEY)).toBe('unobserved');
    // Optimistic on the wire...
    expect(toolPlanForModel(MODEL, observedToolVerdict(MODEL, KEY)).sendTools).toBe(true);
    // ...and the prompt still claims tools, because tools are genuinely sent.
    expect(actionsViaForModel(MODEL, true, observedToolVerdict(MODEL, KEY))).toBe('tools');
  });
});

describe('a refusal that names tools', () => {
  const REFUSAL = {
    status: 400,
    bodyText: JSON.stringify({
      error: { message: 'This model does not support tool use', type: 'invalid_request_error' },
    }),
  };

  it('stops the loop sending definitions it knows will be rejected', () => {
    recordToolAttempt(MODEL, KEY, REFUSAL);
    expect(observedToolVerdict(MODEL, KEY)).toBe('none');
    expect(toolPlanForModel(MODEL, observedToolVerdict(MODEL, KEY)).sendTools).toBe(false);
  });

  it('gives Cat its prose verb back — the half that is easy to miss', () => {
    // If only the loop learned, the prompt would keep claiming `tools` while
    // nothing was sent, and Cat would have NO way to act at all.
    expect(actionsViaForModel(MODEL, true, 'unobserved')).toBe('tools');
    recordToolAttempt(MODEL, KEY, REFUSAL);
    expect(actionsViaForModel(MODEL, true, observedToolVerdict(MODEL, KEY))).toBe('prose');
  });
});

describe('what must NOT be learned', () => {
  it('ignores failures that say nothing about tools', () => {
    for (const attempt of [
      { status: 429, bodyText: '{"error":{"message":"Rate limit reached"}}' },
      { status: 400, bodyText: '{"error":{"message":"maximum context length exceeded"}}' },
      { status: 500, bodyText: 'upstream error' },
      { status: 401, bodyText: '{"error":{"message":"Invalid API key"}}' },
    ]) {
      recordToolAttempt(MODEL, KEY, attempt);
      expect(observedToolVerdict(MODEL, KEY), `status ${attempt.status}`).toBe('unobserved');
    }
  });

  it('recognises the plural form vendors actually send', () => {
    // This exact string matched NOTHING until ai-kit 1.4.1: all eleven refusal
    // patterns assumed a singular subject with `is`. Cat kept re-sending
    // definitions to a model that had already refused, every turn, forever —
    // the outage this whole cache exists to end. Pinned here, not only in
    // ai-kit, because OrangeCat is what breaks if the engine regresses.
    recordToolAttempt(MODEL, KEY, {
      status: 400,
      bodyText: '{"error":{"message":"tools are not supported by this model"}}',
    });
    expect(observedToolVerdict(MODEL, KEY)).toBe('none');
    expect(actionsViaForModel(MODEL, true, observedToolVerdict(MODEL, KEY))).toBe('prose');
  });

  it('still ignores a refusal about a DIFFERENT capability', () => {
    // The near misses that made widening the patterns risky. Recording either
    // as "no tools" would cripple a model that merely cannot stream or see.
    for (const msg of [
      'streaming is not supported for this model',
      'vision is not supported by this model',
    ]) {
      recordToolAttempt(MODEL, KEY, { status: 400, bodyText: `{"error":{"message":"${msg}"}}` });
      expect(observedToolVerdict(MODEL, KEY), msg).toBe('unobserved');
    }
  });

  it('does not let one user key answer for another', () => {
    // Capability genuinely differs per credential — a key without tool access,
    // a different tier, a proxy in front. A negative learned on one key must
    // not silence Cat for everybody else on the same model.
    recordToolAttempt(MODEL, KEY, {
      status: 400,
      bodyText: '{"error":{"message":"This model does not support tool use"}}',
    });
    expect(observedToolVerdict(MODEL, KEY)).toBe('none');
    expect(observedToolVerdict(MODEL, 'sk-somebody-elses-key')).toBe('unobserved');
  });
});

describe('a success', () => {
  it('is recorded as native, and native survives a later ambiguous failure', () => {
    recordToolAttempt(MODEL, KEY, {
      status: 200,
      parsed: {
        choices: [
          {
            finish_reason: 'tool_calls',
            message: { tool_calls: [{ id: 't1', function: { name: 'web_search' } }] },
          },
        ],
      },
    });
    expect(observedToolVerdict(MODEL, KEY)).toBe('native');

    // A rate limit afterwards must not demote a model we have SEEN use tools.
    recordToolAttempt(MODEL, KEY, { status: 429, bodyText: 'slow down' });
    expect(observedToolVerdict(MODEL, KEY)).toBe('native');
    expect(toolPlanForModel(MODEL, observedToolVerdict(MODEL, KEY)).sendTools).toBe(true);
  });
});

/**
 * The semantic judge, and the promise it has to actually keep.
 *
 * #989 made the `why` axis advisory because its detector is a list of fifteen
 * English connectives — a reply that reasons in other words scores zero, and on
 * 2026-09-12 one did and paged the founder as a REGRESSION. The output then
 * told the operator: "Set CAT_EVAL_JUDGE=1 to judge it semantically and gate on
 * it."
 *
 * That was a promise with nothing behind it. The flag existed; the judge did
 * not. Setting it would have gated on the very phrase list it was meant to
 * replace — strictly worse than leaving it off, because the operator would
 * believe the number meant something.
 *
 * Same bug as telling the model it could post to Nostr with nothing that
 * publishes: a flag is a claim, and a claim needs an implementation. These
 * tests exist so the flag cannot outlive the judge again.
 */
import { vi } from 'vitest';
// @ts-expect-error — .mjs harness without types; this is the real module.
import { judgeWhy, computePass } from '../../../scripts/eval-cat.mjs';

const reply = 'As a bakery you already have the skill, so selling loaves as Products fits.';

function answering(word: string) {
  return vi.fn(async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: word } }] }),
  }));
}

describe('the judge answers, or admits it could not', () => {
  it('reads a plain YES and NO', async () => {
    await expect(judgeWhy(reply, { apiKey: 'k', fetchImpl: answering('YES') })).resolves.toBe(true);
    await expect(judgeWhy(reply, { apiKey: 'k', fetchImpl: answering('NO') })).resolves.toBe(false);
  });

  it('returns NULL rather than a verdict when it cannot judge', async () => {
    // Null is the load-bearing value: it means "not judged", which is not the
    // same as "the reply failed to explain itself".
    const cases: Array<[string, unknown]> = [
      ['no api key', { apiKey: '', fetchImpl: answering('YES') }],
      ['empty reply', { apiKey: 'k', fetchImpl: answering('YES') }],
      ['http error', { apiKey: 'k', fetchImpl: vi.fn(async () => ({ ok: false })) }],
      [
        'transport threw',
        {
          apiKey: 'k',
          fetchImpl: vi.fn(async () => {
            throw new Error('ECONNRESET');
          }),
        },
      ],
      [
        'unparseable body',
        {
          apiKey: 'k',
          fetchImpl: vi.fn(async () => ({
            ok: true,
            json: async () => {
              throw new Error('not json');
            },
          })),
        },
      ],
      ['a non-answer', { apiKey: 'k', fetchImpl: answering('it depends, possibly') }],
    ];

    for (const [label, opts] of cases) {
      const text = label === 'empty reply' ? '   ' : reply;
      await expect(judgeWhy(text, opts), label).resolves.toBeNull();
    }
  });

  it('asks about REASONING, and does not demand the word "because"', async () => {
    // The whole point: the phrase list failed a reply that reasoned in other
    // words, so the judge must not re-impose a vocabulary.
    const fetchImpl = answering('YES');
    await judgeWhy(reply, { apiKey: 'k', fetchImpl });

    const body = JSON.parse((fetchImpl.mock.calls[0]![1] as { body: string }).body);
    const system = body.messages[0].content as string;
    expect(system).toMatch(/REASON/);
    expect(system).toMatch(/not required/);
    // Negative half, and it is the stronger one: a mutant ADDING "the word
    // because is required" left the original sentence in place, so the
    // positive assertion above still matched and the mutant walked through.
    expect(system).not.toMatch(/\bis required\b/i);
    expect(system).not.toMatch(/must (use|contain|include) the word/i);
    expect(body.temperature).toBe(0);
  });

  it('sends the key as a bearer token and nothing else', async () => {
    const fetchImpl = answering('YES');
    await judgeWhy(reply, { apiKey: 'sk-secret', fetchImpl });
    const init = fetchImpl.mock.calls[0]![1] as { headers: Record<string, string> };
    expect(init.headers.Authorization).toBe('Bearer sk-secret');
  });
});

describe('an unjudged run never gates on the phrase list', () => {
  const scores = { type: 8, why: 6, duplicates: 0, max: 8 };

  it('stays advisory when the judge answered for only some probes', () => {
    // The trap this closes: flipping the flag on, the judge failing quietly for
    // half the probes, and the run then failing on a regex score the operator
    // believes was judged.
    expect(computePass(scores, { judgeWhy: true, judged: 0 })).toBe(true);
    expect(computePass(scores, { judgeWhy: true, judged: 7 })).toBe(true);
  });

  it('gates only when every probe was actually judged', () => {
    expect(computePass(scores, { judgeWhy: true, judged: 8 })).toBe(false);
    expect(computePass({ ...scores, why: 8 }, { judgeWhy: true, judged: 8 })).toBe(true);
  });

  it('still fails on structure regardless of judging', () => {
    // `type` reads what was attached and whether a question was asked — facts a
    // regex can check honestly — so it gates in every configuration.
    for (const judged of [0, 8]) {
      expect(
        computePass({ ...scores, type: 3 }, { judgeWhy: true, judged }),
        `judged=${judged}`
      ).toBe(false);
    }
  });

  it('is unchanged when the judge is off', () => {
    expect(computePass(scores, { judgeWhy: false, judged: 8 })).toBe(true);
    expect(computePass({ ...scores, type: 3 }, { judgeWhy: false })).toBe(false);
  });
});

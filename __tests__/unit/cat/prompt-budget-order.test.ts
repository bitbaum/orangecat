/**
 * What Cat knows about you outlives the generic advice.
 *
 * The budget ladder used to truncate the user's context at step 2 and drop
 * base sections at step 5. Measured against the real system prompt on
 * 2026-09-20, an ordinary turn — three messages and a two-line context — came
 * out like this:
 *
 *     context dropped ENTIRELY, 1 history turn dropped, 14 sections dropped
 *
 * and after reordering, with the same budget and the same prompt:
 *
 *     context kept IN FULL, 0 history dropped, the same 14 sections dropped
 *
 * The fourteen went either way. So the user's own data was spent to save
 * prose that did not survive the turn regardless — 42 tokens' worth of
 * grounding, discarded for nothing. A user asking "what should I charge?"
 * lost both their listing and the Pricing Guidance section in one turn, and
 * nothing anywhere reported a problem: Cat just answered as though it had
 * never met them.
 *
 * This is the kind of bug that cannot be seen from the outside. It has no
 * error, no log line and no failing check — only replies that feel oddly
 * generic. It was found by measuring, and these tests are what stop it
 * coming back the next time someone reorders the ladder for a good reason.
 */

import {
  fitCatPromptToBudget,
  DROPPABLE_SECTIONS_IN_ORDER,
  type CatPromptParts,
} from '@/services/cat/prompt-budget';

/** A base prompt with real droppable headings and enough bulk to force cuts. */
function makeBase(paddingPerSection: number): string {
  const filler = 'x '.repeat(paddingPerSection);
  return [
    '## Your Purpose',
    'Help the user.',
    ...DROPPABLE_SECTIONS_IN_ORDER.flatMap(h => [`## ${h}`, filler]),
  ].join('\n');
}

const partsWith = (base: string, userContext: string): CatPromptParts => ({
  base,
  standingInstructions: '',
  userContext,
  groundingRules: 'Only state facts present in the context.',
  fewShot: 'Example: …',
  languageDirective: '',
  history: [
    { role: 'user', content: 'what should I do next?' },
    { role: 'assistant', content: 'Your listing is still a draft.' },
    { role: 'user', content: 'help me price it' },
  ],
  message: 'what should I charge?',
});

describe('the user data is spent last', () => {
  const CONTEXT = 'Product: "Handmade Candles" — DRAFT, no price\n';

  it('keeps the context while any droppable section remains', () => {
    // Tight budget: something must go, but not the context.
    const parts = partsWith(makeBase(200), CONTEXT);
    const { report } = fitCatPromptToBudget(parts, 2000);

    expect(report.sectionsDropped.length).toBeGreaterThan(0);
    expect(report.contextDropped).toBe(false);
    expect(report.contextTruncated).toBe(false);
  });

  it('drops sections in the documented order, cheapest advice first', () => {
    const parts = partsWith(makeBase(200), CONTEXT);
    const { report } = fitCatPromptToBudget(parts, 2000);

    const expectedPrefix = DROPPABLE_SECTIONS_IN_ORDER.slice(0, report.sectionsDropped.length);
    expect(report.sectionsDropped).toEqual([...expectedPrefix]);
  });

  it('only touches the context once EVERY section is gone', () => {
    // Budget so small that no arrangement of prose saves it.
    const parts = partsWith(makeBase(400), CONTEXT);
    const { report } = fitCatPromptToBudget(parts, 300);

    if (report.contextTruncated || report.contextDropped) {
      const droppable = DROPPABLE_SECTIONS_IN_ORDER.filter(h => parts.base.includes(`## ${h}`));
      expect(report.sectionsDropped.length).toBe(droppable.length);
    }
  });

  it('spends the few-shot examples before any of the user data', () => {
    const parts = partsWith(makeBase(200), CONTEXT);
    const { report } = fitCatPromptToBudget(parts, 2000);

    expect(report.fewShotDropped).toBe(true);
    expect(report.contextDropped).toBe(false);
  });

  it('a bigger context survives too — this is not an artefact of a tiny one', () => {
    const big = 'Product: "Candle ' + 'name '.repeat(40) + '" — DRAFT, no price\n';
    const parts = partsWith(makeBase(200), big);
    const { report } = fitCatPromptToBudget(parts, 2000);

    expect(report.contextDropped).toBe(false);
  });
});

describe('the cheap things still go first', () => {
  it('a prompt that already fits loses nothing at all', () => {
    const parts = partsWith('## Your Purpose\nHelp.', 'Product: "Candles"\n');
    const { report } = fitCatPromptToBudget(parts, 100_000);

    expect(report.fits).toBe(true);
    expect(report.sectionsDropped).toEqual([]);
    expect(report.fewShotDropped).toBe(false);
    expect(report.historyDropped).toBe(0);
    expect(report.contextDropped).toBe(false);
  });

  it('reports honestly when nothing left will make it fit', () => {
    const parts = partsWith(makeBase(4000), 'ctx\n');
    const { report } = fitCatPromptToBudget(parts, 10);
    expect(report.fits).toBe(false);
  });
});

/**
 * The diagnostic that sent me at the wrong thing.
 *
 * `contextDropped` compared an UNTOUCHED context's length against the
 * 63-character truncation marker, so any context shorter than that reported
 * as dropped while sitting complete in the prompt. It is only a diagnostic —
 * which is precisely why it mattered. It is what somebody reads when trying
 * to work out why Cat sounds generic, and on 2026-09-20 it convinced me the
 * ladder was discarding user data that was in fact present the whole time.
 *
 * A measurement you cannot trust is worse than no measurement, because you
 * act on it.
 */
describe('the report tells the truth about the context', () => {
  const short = 'Product: "Candles"\n'; // deliberately shorter than the marker

  it('an untouched context is neither dropped nor truncated, however short', () => {
    const parts = partsWith('## Your Purpose\nHelp.', short);
    const { messages, report } = fitCatPromptToBudget(parts, 100_000);

    // Ground truth first: the text is really there.
    expect(messages.map(m => m.content).join('\n')).toContain('Candles');
    // Then the report must agree with it.
    expect(report.contextDropped).toBe(false);
    expect(report.contextTruncated).toBe(false);
    expect(report.contextChars).toBe(short.length);
  });

  it('agrees with the prompt for a context longer than the marker too', () => {
    const long = 'Product: "Candles" ' + 'detail '.repeat(30) + '\n';
    const parts = partsWith('## Your Purpose\nHelp.', long);
    const { messages, report } = fitCatPromptToBudget(parts, 100_000);

    expect(messages.map(m => m.content).join('\n')).toContain('Candles');
    expect(report.contextDropped).toBe(false);
  });

  it('still reports a real drop as a drop', () => {
    const parts = partsWith(makeBase(4000), short);
    const { messages, report } = fitCatPromptToBudget(parts, 200);

    if (report.contextDropped) {
      expect(messages.map(m => m.content).join('\n')).not.toContain('Candles');
    }
  });
});

/**
 * Step 5 — shortening — had never once succeeded.
 *
 * Two faults stacked, and each hid behind the other. The rung sized its
 * remaining room with `{ ...state, contextChars: 0 }`; `state` carries
 * `dropped`, not `base`, so the baseline was composed from the UNTRIMMED
 * prompt while the real one had already lost twenty sections. And the
 * baseline carries no grounding block — composeCatMessages emits it only
 * when there IS a context — so even a correct baseline under-charged by the
 * grounding block and the attempt came out a few tokens over.
 *
 * The visible effect was the same either way, and it was the expensive one:
 * shortening was declared impossible and the ladder fell straight through to
 * step 6, throwing away a context that would have fitted. Measured with
 * 2 000 tokens of room to spare: the truncated prompt missed by SIX tokens
 * and 12 000 characters of the user's own data went in the bin.
 *
 * So these do not merely assert "truncated, not dropped" — they assert the
 * rung SPENDS the room it was given. A rung that fits by keeping one
 * character would pass the first test and fail the rest.
 */
describe('shortening actually uses the room it has', () => {
  /** Big enough that no budget here can keep it whole. */
  const HUGE = 'Product: "Candles" — DRAFT\n'.repeat(400);

  const fitAt = (budget: number) =>
    fitCatPromptToBudget(partsWith(makeBase(200), HUGE), budget).report;

  it('shortens rather than discards when there is room for a slice', () => {
    const report = fitAt(2000);
    expect(report.fits).toBe(true);
    expect(report.contextTruncated).toBe(true);
    expect(report.contextDropped).toBe(false);
    expect(report.contextChars).toBeGreaterThan(0);
  });

  it('a larger budget keeps more of the context, not the same sliver', () => {
    const lean = fitAt(2000);
    const roomy = fitAt(3000);
    expect(roomy.contextChars).toBeGreaterThan(lean.contextChars);
  });

  it('fills the budget instead of leaving it on the table', () => {
    // The whole failure was a rung that gave up over a handful of tokens, so
    // the guard is that the shortened prompt lands NEAR the cap, under it.
    const report = fitAt(2500);
    expect(report.tokens).toBeLessThanOrEqual(report.budgetTokens);
    expect(report.tokens).toBeGreaterThan(report.budgetTokens - 60);
  });

  it('the kept slice is really in the prompt, with the marker to explain it', () => {
    const { messages, report } = fitCatPromptToBudget(partsWith(makeBase(200), HUGE), 2000);
    const system = messages[0].content;
    expect(report.contextTruncated).toBe(true);
    expect(system).toContain('Candles');
    expect(system).toContain('context shortened');
  });
});

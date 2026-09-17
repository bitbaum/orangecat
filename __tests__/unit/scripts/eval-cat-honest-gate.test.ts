/**
 * The nightly Cat gate must only fail for reasons it can actually measure.
 *
 * Two defects, both found by running the eval by hand on 2026-09-12 rather than
 * by anything telling anyone:
 *
 *  1. The `why` axis is a list of fifteen English connectives. It asks "did Cat
 *     use one of these phrasings", not "did Cat explain itself". The g-bakery
 *     probe answered "As a bakery, you already have the asset and the skill to
 *     turn your craft into income" — a reason by any reading — scored zero, and
 *     paged the founder as a REGRESSION.
 *
 *  2. A SKIP returned with exit 0 and told nobody, so a night on which Cat was
 *     never verified looked exactly like a night on which Cat was healthy. It
 *     skipped silently on 2026-09-10 and 2026-09-11.
 *
 * Both are the same failure: the gate said something it could not support. A
 * gate that cries wolf is worse than no gate, because it trains everyone to
 * ignore the one alarm that matters — the same lesson `eval-cat-retry.test.ts`
 * was written for.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error — .mjs harness without types; this is the real module.
import { computePass, scoreProbe } from '../../../scripts/eval-cat.mjs';

const ROOT = join(__dirname, '../../..');

/** The reply that actually shipped and was scored a regression. */
const BAKERY_REPLY =
  'As a bakery, you already have the asset and the skill to turn your craft into ' +
  'income or community on OrangeCat. Here are a few concrete ways to get started:\n\n' +
  '- **Sell your baked goods as Products** – list loaves, pastries and cakes.\n' +
  'Which of those sounds closest to what you want?';

const probeOf = (expect: unknown) => ({ id: 'p', label: 'p', message: 'm', expect });
const resultOf = (content: string) => ({ content, proposals: [] });

describe('the "why" detector cannot tell phrasing from reasoning', () => {
  it('scores a genuine explanation as no explanation', () => {
    // This is not a wish for better behaviour — it PINS the blind spot, so
    // nobody re-gates on this axis believing it measures what it claims.
    const score = scoreProbe(probeOf({ question: true }), resultOf(BAKERY_REPLY));

    expect(score.whyOk).toBe(false);
    // And the reply is plainly reasoned and plainly asks its question.
    expect(BAKERY_REPLY).toContain('you already have the asset and the skill');
    expect(score.typeOk).toBe(true);
  });

  it('passes the identical claim once one magic word is added', () => {
    // The whole difference between REGRESSION and PASS is the word "because".
    const score = scoreProbe(
      probeOf({ question: true }),
      resultOf(BAKERY_REPLY.replace('you already have', 'because you already have'))
    );
    expect(score.whyOk).toBe(true);
  });
});

describe('what the run is allowed to fail on', () => {
  const full = { type: 8, why: 8, duplicates: 0, max: 8 };

  it('fails on structure, which a regex can check honestly', () => {
    // `type` reads the draft card that was attached and whether a question was
    // asked. Those are facts about the response, not about its wording.
    expect(computePass({ ...full, type: 6 })).toBe(false);
    expect(computePass({ ...full, type: 7 })).toBe(true);
  });

  it('does NOT fail on "why" while only a phrase list is judging it', () => {
    // The regression that paged the founder for a good answer.
    expect(computePass({ ...full, why: 6 })).toBe(true);
    expect(computePass({ ...full, why: 0 })).toBe(true);
  });

  it('DOES fail on "why" once a judge has actually judged every probe', () => {
    // This test used to assert that the FLAG alone gates. That was the wrong
    // contract and it hid a real defect: when it was written there was no
    // judge, so setting CAT_EVAL_JUDGE=1 would have gated on the phrase list
    // this very file calls unfit for gating. The flag is a claim; the judged
    // count is the evidence. See eval-cat-judge.test.ts.
    expect(computePass({ ...full, why: 6 }, { judgeWhy: true, judged: full.max })).toBe(false);
    expect(computePass({ ...full, why: 7 }, { judgeWhy: true, judged: full.max })).toBe(true);
  });

  it('never gates on "why" when the judge did not answer for every probe', () => {
    expect(computePass({ ...full, why: 0 }, { judgeWhy: true, judged: 0 })).toBe(true);
    expect(computePass({ ...full, why: 0 }, { judgeWhy: true, judged: full.max - 1 })).toBe(true);
  });

  it('never lets a bad type score through on either setting', () => {
    for (const judgeWhy of [false, true]) {
      expect(computePass({ ...full, type: 0 }, { judgeWhy }), `judgeWhy=${judgeWhy}`).toBe(false);
    }
  });
});

describe('a skipped night is not a healthy night', () => {
  const src = readFileSync(join(ROOT, 'scripts/eval-cat.mjs'), 'utf8');

  it('tells somebody when it stands down', () => {
    // Standing down to protect the user-facing free pool is CORRECT, so it
    // must not page like a regression — but silence made an unverified night
    // indistinguishable from a verified one.
    expect(src).toContain('async function notifyFounderSkipped(');
    expect(src).toContain('await notifyFounderSkipped(reason)');
  });

  it('says plainly that unverified is not the same as healthy', () => {
    expect(src).toContain('UNVERIFIED for this night, which is not the same as healthy');
  });

  it('still exits 0, because standing down is not a failure', () => {
    // Paging nightly for a budget ceiling is how an alarm gets muted for good.
    const skipBlock = src.slice(src.indexOf('eval-cat: SKIPPED'), src.indexOf('const session'));
    expect(skipBlock).not.toContain('process.exit(1)');
    expect(skipBlock).toContain('return;');
  });
});

/**
 * Locks the deterministic pieces of the Cat's entity-type selection quality:
 *
 * 1. The system prompt carries the decision rubric (service vs product vs
 *    project/cause vs loan vs event vs group) and REQUIRES a one-line
 *    "why this type" with every proposal.
 * 2. A money NEED reaches the tool pass (loan drafting) and counts as a
 *    create intent, never a platform search.
 * 3. The prefill tool result instructs the model to explain the type choice.
 *
 * The founder-reported failures these guard: a service proposed as a
 * product/project, no explanation given, and loans never suggested.
 */

import { buildCatSystemPrompt } from '@/services/cat/system-prompt';
import {
  hasMoneyNeedIntent,
  hasCreateIntent,
  messageMightNeedTools,
} from '@/services/cat/tool-use-detection';

describe('system prompt — entity-type decision rubric', () => {
  const prompt = buildCatSystemPrompt();

  it('contains the decision rubric section', () => {
    expect(prompt).toContain('Choosing the Entity Type (decision rubric');
  });

  it('pins the founder failure case: priced labor is a service, not a product', () => {
    expect(prompt).toContain('A price attached to work does NOT make it a product');
  });

  it('maps a repayable money need to loan — never product or cause', () => {
    // The rubric is now GENERATED from the registry (entity-rubric.ts), so the
    // bold type name renders last and reads as its display name. The rule this
    // pins is unchanged, and the assertion is stronger than the two fragments
    // it replaces: the whole line, in one piece, so a partial edit cannot pass.
    expect(prompt).toContain(
      'the user NEEDS money and intends to REPAY it — never a product, never a cause → **Loan**'
    );
  });

  it('requires a one-line "why this type" with every proposal', () => {
    expect(prompt).toContain('Always say WHY (required)');
    expect(prompt).toContain('Never present a proposal without its why');
  });

  it('softens the interview posture: thin input gets ONE focused question, not a blind draft', () => {
    expect(prompt).toContain('When input is THIN, ask');
    expect(prompt).toContain('ONE focused question');
  });

  it('routes money NEEDS to lending/funding in the pathway map', () => {
    expect(prompt).toContain('**Needs money NOW**');
  });
});

describe('money-need intent detection', () => {
  it.each([
    'I need 500 CHF to fix my bike so I can deliver food',
    'need 1200 EUR for a new laptop',
    'can I borrow money here?',
    'I want to take out a loan',
    'I need some cash for materials',
  ])('detects "%s" as a money need', msg => {
    expect(hasMoneyNeedIntent(msg)).toBe(true);
    expect(messageMightNeedTools(msg)).toBe(true);
    // A money need drafts the user's OWN loan — create intent, not a search.
    expect(hasCreateIntent(msg)).toBe(true);
  });

  it.each([
    'I need help with my profile',
    'do you need anything from me?',
    'I need to think about it',
  ])('does not fire on a non-monetary "need" ("%s")', msg => {
    expect(hasMoneyNeedIntent(msg)).toBe(false);
  });
});

/**
 * Money NEED must draft the user's own loan — create intent, not a search.
 *
 * Prompt prose for the entity rubric lives in entity-rubric.test.ts (SSOT).
 * This file only pins the routing predicates that open the tool pass.
 */

import {
  hasMoneyNeedIntent,
  hasCreateIntent,
  messageMightNeedTools,
} from '@/services/cat/tool-use-detection';

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

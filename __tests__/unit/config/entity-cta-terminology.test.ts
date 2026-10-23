/**
 * The primary CTA is the single most-read sentence on a public entity page —
 * it is the label on the button a stranger presses to part with money. Our
 * terminology guide bans a specific set of words there, for a reason that is
 * about product positioning rather than style:
 *
 *  - "donate"/"donation" frames the payer as a charity's benefactor. OrangeCat
 *    spans gift → loan → investment; the giving end of that range is still an
 *    economic relationship, not alms.
 *  - "tip" frames the payment as optional garnish.
 *  - "crypto" is a category we are not in — this is Bitcoin.
 *  - "campaign" is crowdfunding vocabulary we deliberately left behind.
 *
 * A `cause` shipped as "Donate" for months and nothing caught it, so this is
 * the check rather than a note in a doc.
 */

import { ENTITY_PRIMARY_CTA } from '@/config/entity-cta';

const BANNED = ['donate', 'donation', 'tip', 'crypto', 'campaign', 'charity'];

describe('entity primary CTA terminology', () => {
  it.each(Object.entries(ENTITY_PRIMARY_CTA))('%s: "%s" avoids banned wording', (_type, label) => {
    const words = label
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter(Boolean);
    for (const banned of BANNED) {
      expect(words).not.toContain(banned);
    }
  });

  it('gives every entity a verb, not a shrug', () => {
    // "View" is the registry fallback for entities with no transaction. A real
    // economic entity landing on it means someone added a type and never chose
    // its verb — the page then asks the visitor to do nothing in particular.
    for (const [type, label] of Object.entries(ENTITY_PRIMARY_CTA)) {
      expect(label.trim().length).toBeGreaterThan(2);
      expect(`${type}:${label}`).not.toMatch(/:(TODO|TBD)/i);
    }
  });
});

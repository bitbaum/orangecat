/**
 * THE DECISION RUBRIC, GENERATED — which entity fits, and why.
 *
 * Cat must pick the right type and say why it fits. Until now the rubric that
 * told it how was a hand-written list in the brief, and it had two faults that
 * a copy always eventually has.
 *
 * It was INCOMPLETE. Eight of the fifteen types had a rule. Nothing told Cat
 * when to reach for a Research entity, a Wishlist, an Investment or a
 * Companion, so those were proposed rarely and wrongly — a funded enquiry came
 * out as a Project, and a list of wanted things came out as a Cause.
 *
 * And it was a COPY, restating in prose what `entity-registry.ts` already
 * knows. That is the same defect this codebase spent a week removing from its
 * docs, sitting in the one file that decides what Cat actually proposes.
 *
 * So the rubric is derived: `choose` says when the type fits, `wallet.why`
 * says what money moves, and the display name is whatever a person is shown
 * (`ai_assistant` reads as "Companion" — the type id is not the word).
 *
 * ── On the pairs ────────────────────────────────────────────────────────────
 * Coverage fixes the types Cat never reached for. It does NOT fix the ones it
 * reaches for wrongly, because those failures are about a PAIR — the cost of
 * confusing two types, which is a fact about neither of them alone. Those stay
 * written down, deliberately, and each one is a mistake that was actually made.
 */

import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { CAT_CREATABLE_ENTITY_TYPES } from '@/types/cat';

/**
 * The confusions worth spending prompt on. Each is a real wrong proposal, and
 * the discriminator is the question that separates them in one step.
 *
 * Kept short on purpose: a table of every possible pair is noise, and noise in
 * a brief is indistinguishable from no guidance at all.
 */
export const ENTITY_CONFUSIONS: ReadonlyArray<{ pair: string; ask: string }> = [
  {
    pair: 'service vs product',
    ask: 'does an ITEM change hands? A price attached to work does not make it a product — "haircuts at home, 40 CHF" is a service.',
  },
  {
    pair: 'project vs cause',
    ask: 'is there an end state someone can be held to? Milestones and a finish → project. Open-ended need → cause.',
  },
  {
    pair: 'loan vs anything else',
    ask: 'do they intend to REPAY it? Then it is a loan, however the ask was phrased. Answering a money NEED with only "sell something" is the failure here.',
  },
  {
    pair: 'investment vs loan',
    ask: 'is a return or a share owed, or a repayment schedule? The first is an investment, the second a loan.',
  },
  {
    pair: 'wishlist vs cause',
    ask: 'can someone just buy the named thing? Specific items → wishlist. Money toward a need → cause.',
  },
  {
    pair: 'group vs circle',
    ask: 'do they want governance and a shared wallet, or only each other? Structure → group. Trust and informality → circle.',
  },
];

/** The rubric block the brief carries verbatim. */
export function entityRubric(): string {
  const lines = CAT_CREATABLE_ENTITY_TYPES.map(type => {
    const meta = ENTITY_REGISTRY[type];
    return `- ${meta.choose} → **${meta.name}**`;
  });

  const pairs = ENTITY_CONFUSIONS.map(c => `- **${c.pair}** — ${c.ask}`);

  return [
    'Pick the type from what the thing IS, not from the words used:',
    ...lines,
    '',
    'When two fit, these are the ones actually confused:',
    ...pairs,
  ].join('\n');
}

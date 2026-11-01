import { CAT_ACTIONS } from '@/config/cat-actions';

/**
 * Confusable verbs must stay disambiguated.
 *
 * Twice in one day a new Cat verb was shadowed by an older one with overlapping
 * vocabulary, and both times only production caught it:
 *
 *  - "add this topic to your public PROFILE" → the model ran update_profile and
 *    offered to edit the bio, so publish_interest was unreachable.
 *  - "REMOVE my public interests"            → the model ran forget_memories and
 *    deleted private memories, including one the user had held for weeks.
 *
 * The second is the dangerous shape: the wrong verb destroyed data. A model can
 * only pick the right verb if the descriptions say which is which, so that
 * routing text is a correctness requirement, not documentation. Adding a verb
 * whose trigger words overlap an existing one means adding a row here.
 */

interface ConfusablePair {
  /** The newer, more specific verb that keeps losing. */
  action: string;
  /** The established verb that shadows it. */
  shadowedBy: string;
  /** Why picking wrong is bad — kept in the failure message. */
  consequence: string;
  /** Phrasings that must not appear, because they steer to the wrong verb. */
  forbiddenPhrases?: RegExp[];
}

const CONFUSABLE: ConfusablePair[] = [
  {
    action: 'publish_interest',
    shadowedBy: 'update_profile',
    consequence: 'the model edits the bio instead, and being findable never happens',
    forbiddenPhrases: [/on their public profile/i],
  },
  {
    action: 'unpublish_interest',
    shadowedBy: 'forget_memories',
    consequence: 'the model deletes private memories the user never asked it to touch',
  },
  {
    // "add a wallet" and "connect my wallet" are the same sentence to a model,
    // but only one of them makes the user payable. add_wallet is the older,
    // broader verb and refuses outright when there is no receiving rail — so a
    // user with no wallet (73 of 76 production profiles in August 2026) hits a
    // dead end at exactly the moment they were ready to be paid.
    action: 'connect_wallet',
    shadowedBy: 'add_wallet',
    consequence:
      'the model creates an empty savings goal and the user still cannot receive a single payment',
  },
  {
    // "ask Loki whether the shop is live" and "send this to Loki" both name
    // Loki. One is a read-only question answered as the person; the other
    // dispatches agents into their repositories and is confirmed as high
    // risk. Picking the dispatch for a question sets agents to work on a
    // sentence that was never a task.
    action: 'ask_loki',
    shadowedBy: 'send_task_to_loki',
    consequence: "a question becomes a coding task dispatched to the person's projects",
  },
];

describe('confusable Cat verbs stay disambiguated', () => {
  it.each(CONFUSABLE)(
    '$action names $shadowedBy so the model can tell them apart',
    ({ action, shadowedBy, consequence }) => {
      const desc = CAT_ACTIONS[action]?.description;
      expect(desc).toBeDefined();
      // "NOT update_profile" / "NOT forget_memories" — an explicit negative.
      expect(desc).toMatch(new RegExp(`not ${shadowedBy}`, 'i'));
      if (!new RegExp(`not ${shadowedBy}`, 'i').test(desc!)) {
        throw new Error(`Without this, ${consequence}.`);
      }
    }
  );

  it.each(CONFUSABLE)('$shadowedBy points back at $action', ({ action, shadowedBy }) => {
    // The disambiguation has to be readable from BOTH sides: the model may be
    // looking at the established verb when it decides.
    expect(CAT_ACTIONS[shadowedBy]?.description).toContain(action);
  });

  it.each(CONFUSABLE.filter(c => c.forbiddenPhrases?.length))(
    '$action avoids the phrasings that mis-route it',
    ({ action, forbiddenPhrases }) => {
      for (const phrase of forbiddenPhrases!) {
        expect(CAT_ACTIONS[action].description).not.toMatch(phrase);
      }
    }
  );
});

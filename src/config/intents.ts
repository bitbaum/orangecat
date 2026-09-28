/**
 * Intents — what a person came here to DO, in their words.
 *
 * The entity registry answers "what can hold a wallet" (fifteen nouns). A
 * person does not arrive with a noun; they arrive with an intent: earn, fund,
 * borrow, do something together, look after their money, teach their Cat.
 * This file is the one place those intents are named and ordered. Every
 * registry entry declares the intent it serves through `plain.intent`, and the
 * map page ("What you can do"), the create hub and the Cat's suggestions all
 * group by this list — so a new entity type shows up under the right heading
 * everywhere by declaring one field, and nothing restates the grouping.
 *
 * Six, deliberately. A heading a person cannot pick between is a heading too
 * many; a heading with one item under it is a noun in disguise.
 */

export const INTENT_IDS = ['earn', 'fund', 'borrow', 'together', 'money', 'cat'] as const;
export type IntentId = (typeof INTENT_IDS)[number];

export interface Intent {
  id: IntentId;
  /** The heading, as a verb phrase the person would say. */
  title: string;
  /** One line under the heading: what happens in this group and how it works. */
  how: string;
}

export const INTENTS: Readonly<Record<IntentId, Intent>> = {
  earn: {
    id: 'earn',
    title: 'Earn',
    how: 'Offer a thing, your time, or a companion you made. People pay you directly — no platform fee, no middleman holding the money.',
  },
  fund: {
    id: 'fund',
    title: 'Fund',
    how: 'Ask people to back something: a goal with milestones, ongoing work, a question worth answering, or the things you need. Every franc that arrives is visible.',
  },
  borrow: {
    id: 'borrow',
    title: 'Borrow & invest',
    how: 'Money with strings, agreed between people: repaid on a schedule, or exchanged for a share. The terms are written once and everyone can read the ledger.',
  },
  together: {
    id: 'together',
    title: 'Together',
    how: 'People acting as one: a shared purse, a shared say, a shared calendar. From four friends to a whole neighbourhood.',
  },
  money: {
    id: 'money',
    title: 'Your money',
    how: 'Where it lands, where it goes, and — if you choose — where you say your public money should go.',
  },
  cat: {
    id: 'cat',
    title: 'Your Cat',
    how: 'The agent that does this for you. Tell it about yourself once; ask it for anything on this page in a sentence.',
  },
};

/** The intents in the order the map and the create hub show them. */
export const INTENT_LIST: readonly Intent[] = INTENT_IDS.map(id => INTENTS[id]);

/**
 * How an entity type reads to the person who wants it — the copy every
 * human-facing surface shows instead of the type's name.
 *
 * `verb` is the thing they came to do ("Sell something"), `what` says what it
 * is in one line, `example` makes it concrete, and `steps` are the three things
 * that happen, in order. All four are read by the map, the create hub, the
 * empty states and the Cat's suggestions; none of them may be restated there.
 */
export interface PlainCopy {
  intent: IntentId;
  verb: string;
  what: string;
  example: string;
  steps: readonly [string, string, string];
}

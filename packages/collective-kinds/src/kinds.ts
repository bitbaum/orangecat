/**
 * The kinds of collective.
 *
 * A collective is a body of members: a household, a club, a Verein, a co-op,
 * a company, a town, a network state, a local fund. This list answers one
 * question — WHAT KIND OF BODY IS THIS — and nothing else. It does not say how
 * the body decides (Solon owns its governance profiles and keeps its own
 * "which profile fits this kind" table) and it does not say what the body may
 * do with money (OrangeCat owns its group features and keeps its own defaults
 * per kind). Both key their tables by these ids, and a test in each product
 * fails when a kind here has no row there.
 *
 * WHY THIS IS A PACKAGE
 * Until 2026-09-28 the same list lived three times: OrangeCat's group labels,
 * Solon's governance profiles and Solon's marketing audiences — eight, five and
 * five entries, with no link between them, restated by hand in prompts,
 * comments and message files. Copies drift; imports cannot. Same cure as
 * @bitbaum/design-tokens, same rule: change it HERE, tag, bump, ship.
 *
 * ADDING A KIND is adding an entry. Every consumer derives forms, enums, DB
 * constraints and copy from the list, so a kind that exists here exists
 * everywhere — and a kind that needs a place cannot be founded without one.
 */

export const COLLECTIVE_KIND_IDS = [
  'circle',
  'family',
  'association',
  'cooperative',
  'collective',
  'company',
  'guild',
  'dao',
  'town',
  'network_state',
  'local_fund',
] as const;

export type CollectiveKindId = (typeof COLLECTIVE_KIND_IDS)[number];

export interface CollectiveKind {
  id: CollectiveKindId;
  /** English display name. Products translate by id; this is the fallback. */
  name: string;
  /** What it is, in one line a non-lawyer can act on. */
  description: string;
  /**
   * Whether this kind is bound to a place. A town without a place is a word;
   * a DAO with one is decoration. Consumers require a Place at founding when
   * this is true and must not ask for one when it is false.
   */
  needsPlace: boolean;
  /**
   * Whether bodies of this kind can be recognised as tax-exempt (Swiss:
   * gemeinnützig) at all. A claim-limiter, not a promise: false means no
   * surface may ever mention deductible gifts for this kind.
   */
  canBeTaxExempt: boolean;
  /**
   * The legal forms this kind usually takes, per country code. Informational,
   * for the founding screen's hint — the recorded legal form is whatever the
   * founder declares with evidence (see legal.ts).
   */
  usualLegalForms: Partial<Record<string, readonly string[]>>;
}

export const COLLECTIVE_KINDS: Readonly<Record<CollectiveKindId, CollectiveKind>> = {
  circle: {
    id: 'circle',
    name: 'Circle',
    description: 'An informal group of people who trust each other.',
    needsPlace: false,
    canBeTaxExempt: false,
    usualLegalForms: {},
  },
  family: {
    id: 'family',
    name: 'Family',
    description: 'A household deciding and saving together.',
    needsPlace: false,
    canBeTaxExempt: false,
    usualLegalForms: {},
  },
  association: {
    id: 'association',
    name: 'Association',
    description: 'A member association: the assembly is sovereign and the statutes bind it.',
    needsPlace: false,
    canBeTaxExempt: true,
    usualLegalForms: { CH: ['Verein (Art. 60 ZGB)'], DE: ['eingetragener Verein (e.V.)'] },
  },
  cooperative: {
    id: 'cooperative',
    name: 'Cooperative',
    description: 'Member-owned: one member, one vote, and the surplus returns to the members.',
    needsPlace: false,
    canBeTaxExempt: false,
    usualLegalForms: {
      CH: ['Genossenschaft (Art. 828 OR)'],
      DE: ['eingetragene Genossenschaft (eG)'],
    },
  },
  collective: {
    id: 'collective',
    name: 'Collective',
    description: 'A group that moves on consent rather than by counting heads.',
    needsPlace: false,
    canBeTaxExempt: false,
    usualLegalForms: {},
  },
  company: {
    id: 'company',
    name: 'Company',
    description: 'A business with owners, a board and weighted say.',
    needsPlace: false,
    canBeTaxExempt: false,
    usualLegalForms: { CH: ['GmbH', 'AG'], DE: ['GmbH', 'AG', 'UG'] },
  },
  guild: {
    id: 'guild',
    name: 'Guild',
    description: 'A professional association: people of one craft, setting their own bar.',
    needsPlace: false,
    canBeTaxExempt: true,
    usualLegalForms: { CH: ['Verein (Art. 60 ZGB)'] },
  },
  dao: {
    id: 'dao',
    name: 'DAO',
    description: 'A body whose rules run as code and whose votes are signed.',
    needsPlace: false,
    canBeTaxExempt: false,
    usualLegalForms: {},
  },
  town: {
    id: 'town',
    name: 'Town',
    description: 'A civic body for a place: small enough to be known, large enough to run itself.',
    needsPlace: true,
    canBeTaxExempt: false,
    usualLegalForms: {},
  },
  network_state: {
    id: 'network_state',
    name: 'Network state',
    description: 'A digital-first community with shared values and a real membership roll.',
    needsPlace: false,
    canBeTaxExempt: false,
    usualLegalForms: {},
  },
  local_fund: {
    id: 'local_fund',
    name: 'Local fund',
    description:
      'Money residents direct to their own place, governed by them, on top of what the law takes.',
    needsPlace: true,
    canBeTaxExempt: true,
    usualLegalForms: {
      CH: ['Verein (Art. 60 ZGB)', 'Stiftung'],
      DE: ['eingetragener Verein (e.V.)'],
    },
  },
};

/** The kinds as an array, in the order they are declared. */
export const COLLECTIVE_KIND_LIST: readonly CollectiveKind[] = COLLECTIVE_KIND_IDS.map(
  id => COLLECTIVE_KINDS[id]
);

export function isCollectiveKindId(value: unknown): value is CollectiveKindId {
  return typeof value === 'string' && (COLLECTIVE_KIND_IDS as readonly string[]).includes(value);
}

/** The kind, or undefined for a string that is not one. Total: never throws. */
export function kindOf(value: unknown): CollectiveKind | undefined {
  return isCollectiveKindId(value) ? COLLECTIVE_KINDS[value] : undefined;
}

/**
 * Civic split — the SSOT for "of the money I owe the public, where would I
 * send it?"
 *
 * A person declares how they would divide their public contribution between
 * the levels they belong to: their locality (Witikon), their region (the canton
 * of Zürich), their nation (Switzerland). The law fixes the real split; this
 * records the person's own, as a statement, and — once local funds exist — as
 * the standing instruction for what they give voluntarily on top.
 *
 * Two things this must never do, and both are enforced by copy and shape here
 * rather than by good intentions elsewhere:
 *  - suggest the slider changes a tax bill (CIVIC_SPLIT_CAVEAT rides with every
 *    surface that shows the split);
 *  - expose one person's declaration through an aggregate (a place is reported
 *    only once CIVIC_SPLIT_MIN_GROUP people there have declared).
 */

export const CIVIC_LEVEL_IDS = ['locality', 'region', 'nation'] as const;
export type CivicLevelId = (typeof CIVIC_LEVEL_IDS)[number];

export interface CivicLevel {
  id: CivicLevelId;
  label: string;
  /** What the level is, in the reader's own terms. */
  hint: string;
  /** Example places, so the field never reads as abstract. */
  example: string;
}

export const CIVIC_LEVELS: readonly CivicLevel[] = [
  {
    id: 'locality',
    label: 'Locality',
    hint: 'The place you actually live in — a village, a quarter, a town.',
    example: 'Witikon',
  },
  {
    id: 'region',
    label: 'Region',
    hint: 'The canton, state or province around it.',
    example: 'Zürich',
  },
  {
    id: 'nation',
    label: 'Nation',
    hint: 'The country.',
    example: 'Switzerland',
  },
];

/** Shares are whole percentages and always sum to exactly this. */
export const CIVIC_SPLIT_TOTAL = 100;

/** A starting position that favours no level; the person moves it. */
export const CIVIC_SPLIT_DEFAULT: Record<CivicLevelId, number> = {
  locality: 34,
  region: 33,
  nation: 33,
};

/**
 * A place appears in the public aggregate only once this many people there
 * have declared. Below it, an average IS the individuals.
 */
export const CIVIC_SPLIT_MIN_GROUP = 3;

/** Field caps, mirrored by the domain schema. */
export const CIVIC_SPLIT_LIMITS = {
  placeName: 80,
  note: 280,
} as const;

/**
 * The one sentence every surface carries. It is the difference between a
 * statement of preference and a tool for getting someone into trouble.
 */
export const CIVIC_SPLIT_CAVEAT =
  'This is what you would choose. It does not change what the law takes or where it goes — it says where you stand, and it decides where what you give voluntarily goes.';

export const CIVIC_SPLIT_COPY = {
  title: 'Your civic split',
  question: 'Of the money you owe the public, how would you divide it?',
  lede: 'Most systems decide this for you and never ask. Here you say it — and anyone can see what the people of a place would choose.',
  publicLabel: 'Show my split on my public profile',
  publicHint:
    'Off: it still counts, anonymously, in the numbers for your place once enough people there have declared.',
} as const;

/** The card that turns the locality share into a destination. */
export const LOCAL_FUND_COPY = {
  title: 'Where the locality share goes',
  has: (fund: string, locality: string, share: number) =>
    `${locality} has a fund: ${fund}. The ${share}% you give your locality goes there — when you give voluntarily, on top of what the law takes, never instead of it.`,
  give: 'Give to it',
  none: (locality: string) =>
    `${locality} has no fund yet. The first one is a group of kind “local fund”, bound to the place, governed by the people in it.`,
  start: 'Start one',
  loading: 'Looking for your place’s fund…',
} as const;

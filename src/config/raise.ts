/**
 * Raise — "I need A, it costs B, help me get B."
 *
 * The person says what they need in a sentence. The Cat prices it line by
 * line, picks the rail that fits (a gift, a loan, or an investment) and writes
 * the page; they adjust anything and publish in one tap. Each rail is an
 * ordinary entity from the registry — this file only says how a rail reads to
 * someone who has never heard the word "entity", and the limits on a plan.
 */

import type { EntityType } from './entity-registry';

export const RAISE_RAILS = ['fund', 'lend', 'invest'] as const;
export type RaiseRail = (typeof RAISE_RAILS)[number];

export interface RaiseRailCopy {
  rail: RaiseRail;
  /** The entity a published plan becomes. */
  entityType: Extract<EntityType, 'project' | 'loan' | 'investment'>;
  label: string;
  /** What the backer gets back, in plain words. */
  strings: string;
  /** When this rail is the right one. */
  fits: string;
}

export const RAISE_RAIL_COPY: Readonly<Record<RaiseRail, RaiseRailCopy>> = {
  fund: {
    rail: 'fund',
    entityType: 'project',
    label: 'Ask for backing',
    strings: 'People give toward it. You owe nothing back.',
    fits: 'Personal needs, creative work, community things',
  },
  lend: {
    rail: 'lend',
    entityType: 'loan',
    label: 'Borrow it',
    strings: 'People lend it. You repay them on terms you set.',
    fits: 'Something you can pay back over time',
  },
  invest: {
    rail: 'invest',
    entityType: 'investment',
    label: 'Take investment',
    strings: 'People invest. They share in what it earns.',
    fits: 'Something that will make money',
  },
};

/** What to try, tapped straight into the box. */
export const RAISE_EXAMPLES: readonly string[] = [
  'A second oven for my bakery so I can bake on weekdays too',
  'Vet bills for my dog’s knee surgery',
  'Three months of studio rent while I finish my album',
  'A laptop that can run the design software for my course',
];

export const RAISE_LIMITS = {
  /** Shorter than this says too little to price. */
  needMin: 8,
  needMax: 600,
  /** A cost list longer than this stops being readable on a phone. */
  maxLines: 8,
  lineLabelMax: 80,
  titleMax: 100,
  storyMax: 1500,
  /** Loan and investment rates are percent a year. */
  rateMax: 100,
  termMonthsMax: 120,
} as const;

/** Sensible starting terms the person sees and changes before publishing. */
export const RAISE_DEFAULT_TERMS = {
  lend: { ratePercent: 0, termMonths: 12 },
  invest: { ratePercent: 8, termMonths: 36, minimumShare: 0.01 },
} as const;

/** Where the draft waits while the person signs in to publish it. */
export const RAISE_DRAFT_STORAGE_KEY = 'oc:raise-draft';

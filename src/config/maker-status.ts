/**
 * SINGLE SOURCE OF TRUTH FOR MAKER STATUS & HELP-WANTED OPTIONS
 *
 * A public profile (a "maker") should be able to clearly express, at a glance:
 * 1. What they do            → profiles.bio
 * 2. The current status of their work → profiles.current_status (this file)
 * 3. Concrete ways others can help    → profiles.help_wanted (this file)
 *
 * Database CHECK constraints and the Zod schema (src/lib/validation/base.ts)
 * MUST derive from these value lists — do NOT hardcode either list elsewhere.
 */

export const MAKER_STATUS_VALUES = [
  'exploring_ideas',
  'actively_building',
  'shipped_live',
  'seeking_funding',
  'seeking_collaborators',
  'paused',
] as const;

export type MakerStatus = (typeof MAKER_STATUS_VALUES)[number];

export const MAKER_STATUS_METADATA: Record<MakerStatus, { label: string; description: string }> = {
  exploring_ideas: {
    label: 'Exploring Ideas',
    description: 'Still shaping what to build',
  },
  actively_building: {
    label: 'Actively Building',
    description: 'Heads-down making progress',
  },
  shipped_live: {
    label: 'Shipped & Live',
    description: 'Out in the world and usable today',
  },
  seeking_funding: {
    label: 'Seeking Funding',
    description: 'Raising Bitcoin or other support to keep going',
  },
  seeking_collaborators: {
    label: 'Seeking Collaborators',
    description: 'Looking for people to build alongside',
  },
  paused: {
    label: 'On Pause',
    description: 'Not actively worked on right now',
  },
};

export const makerStatusSelectOptions = MAKER_STATUS_VALUES.map(value => ({
  value,
  label: MAKER_STATUS_METADATA[value].label,
}));

export function isMakerStatus(value: string | null | undefined): value is MakerStatus {
  return !!value && (MAKER_STATUS_VALUES as readonly string[]).includes(value);
}

export const HELP_WANTED_VALUES = [
  'funding',
  'collaborators',
  'feedback',
  'users_customers',
  'mentorship',
  'job_opportunities',
  'press_coverage',
  'volunteers',
] as const;

export type HelpWantedOption = (typeof HELP_WANTED_VALUES)[number];

export const HELP_WANTED_METADATA: Record<HelpWantedOption, { label: string }> = {
  funding: { label: 'Funding' },
  collaborators: { label: 'Collaborators' },
  feedback: { label: 'Feedback' },
  users_customers: { label: 'Users / Customers' },
  mentorship: { label: 'Mentorship & Advice' },
  job_opportunities: { label: 'Job Opportunities' },
  press_coverage: { label: 'Press & Coverage' },
  volunteers: { label: 'Volunteers' },
};

export const helpWantedSelectOptions = HELP_WANTED_VALUES.map(value => ({
  value,
  label: HELP_WANTED_METADATA[value].label,
}));

export function isHelpWantedOption(value: string): value is HelpWantedOption {
  return (HELP_WANTED_VALUES as readonly string[]).includes(value);
}

/** Max number of help-wanted tags a profile can select — keeps the "ask" scannable. */
export const MAX_HELP_WANTED_SELECTIONS = 5;

/**
 * Cat autonomy ladder — SSOT.
 *
 * The database already encodes trust as two booleans on cat_permissions
 * (`granted`, `requires_confirmation`); users think in three levels. This
 * module is the ONE place that maps between them, so the API, the settings UI
 * and the executor can never disagree about what "automatic" means.
 *
 *   off  → not granted            → Cat refuses and says it needs permission
 *   ask  → granted + confirmation → Cat prepares it, the user taps Confirm
 *   auto → granted, no confirm    → Cat just does it (spend caps still apply)
 */

import type { ActionRiskLevel } from './cat-actions';

export const AUTONOMY_LEVELS = ['off', 'ask', 'auto'] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export interface AutonomyLevelMeta {
  value: AutonomyLevel;
  label: string;
  description: string;
}

export const AUTONOMY_LEVEL_META: Record<AutonomyLevel, AutonomyLevelMeta> = {
  off: {
    value: 'off',
    label: 'Off',
    description: 'Cat will not do this and will say so.',
  },
  ask: {
    value: 'ask',
    label: 'Ask first',
    description: 'Cat prepares it and waits for your confirmation.',
  },
  auto: {
    value: 'auto',
    label: 'Automatic',
    description: 'Cat does it right away. Spend caps still apply.',
  },
};

/** Stored permission booleans → the level a human sees. */
export function toAutonomyLevel(
  granted: boolean | null | undefined,
  requiresConfirmation: boolean | null | undefined
): AutonomyLevel {
  if (!granted) {
    return 'off';
  }
  return requiresConfirmation === false ? 'auto' : 'ask';
}

/** The level a human picked → what to write / call. */
export function fromAutonomyLevel(level: AutonomyLevel): {
  granted: boolean;
  requiresConfirmation: boolean;
} {
  if (level === 'off') {
    return { granted: false, requiresConfirmation: true };
  }
  return { granted: true, requiresConfirmation: level === 'ask' };
}

/**
 * High-risk actions (payments, investments, loans) must never be settable to
 * fully automatic from the UI — a mistaken tap should not be able to move
 * money without a second look. Spend caps are a limit, not a substitute for
 * intent.
 */
export function allowedLevelsForRisk(risk: ActionRiskLevel): AutonomyLevel[] {
  return risk === 'high' ? ['off', 'ask'] : ['off', 'ask', 'auto'];
}

/** A preset replaces the effective choices, including individual overrides. */
export const PERMISSION_PRESETS = ['minimal', 'creator', 'power', 'none'] as const;
export type PermissionPreset = (typeof PERMISSION_PRESETS)[number];
export function presetAllows(preset: PermissionPreset, category: string): boolean {
  if (preset === 'none') {
    return false;
  }
  if (preset === 'minimal') {
    return category === 'context';
  }
  if (preset === 'power') {
    return category !== 'payments';
  }
  return ['context', 'entities', 'communication'].includes(category);
}

/** What each preset is called and does, in the order a person reads them. */
export const PERMISSION_PRESET_META: Record<
  PermissionPreset,
  { label: string; description: string }
> = {
  none: { label: 'Off', description: 'Cat only talks.' },
  minimal: { label: 'Minimal', description: 'Cat only keeps its memory and notes.' },
  creator: {
    label: 'Creator',
    description: 'Also creates your listings and posts or messages for you.',
  },
  power: { label: 'Power', description: 'Everything except payments.' },
};

export const PERMISSION_PRESET_ORDER: readonly PermissionPreset[] = [
  'none',
  'minimal',
  'creator',
  'power',
];

export const CAT_PERMISSIONS_CHANGED_EVENT = 'cat-permissions-changed';

/**
 * Badge Colors — SSOT for semantic badge/status color classes.
 *
 * All status badges, pill labels, and colored chips across the app pull from
 * here. Changing a semantic color (e.g. "success" from green → teal) is a
 * one-line edit in this file.
 *
 * Pattern: `bg-*-100 text-*-700 border-*-200`
 * The border color is included so callers that add a `border` class get a
 * matching border automatically. Callers without `border` are unaffected.
 */

export const BADGE_COLORS = {
  success: 'bg-status-positive-subtle text-status-positive border-status-positive/20',
  warning: 'bg-status-warning-subtle text-status-warning border-status-warning/20',
  error: 'bg-status-negative-subtle text-status-negative border-status-negative/20',
  info: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900',
  neutral:
    'bg-surface-raised text-fg-primary border-default dark:bg-surface-raised dark:text-fg-secondary dark:border-default',
  muted: 'bg-surface-raised text-fg-secondary border-default',
  amber:
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  orange:
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  tiffany:
    'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
  pink: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-400 dark:border-pink-900',
} as const;

export type BadgeColorKey = keyof typeof BADGE_COLORS;

/**
 * The one translation from a Badge `variant` to the classes that paint it.
 *
 * Two status vocabularies exist on purpose: `variant` is the semantic name a
 * component asks for, `className` is what actually renders. What was NOT on
 * purpose is that the translation between them lived privately inside
 * `EntityCard`, so anything else needing it had to guess — and the guesses
 * drifted. It lives here now, next to the colours it names.
 *
 * `destructive` and `error` are the same paint; both spellings are in use.
 */
export const BADGE_VARIANT_CLASSES = {
  default: BADGE_COLORS.neutral,
  secondary: BADGE_COLORS.neutral,
  success: BADGE_COLORS.success,
  warning: BADGE_COLORS.warning,
  info: BADGE_COLORS.info,
  error: BADGE_COLORS.error,
  destructive: BADGE_COLORS.error,
} as const;

export type BadgeVariantKey = keyof typeof BADGE_VARIANT_CLASSES;

/**
 * Stat panel accent colors — for full-card colored panels (stat cards, KPI tiles).
 * Lighter variant: bg-*-50 text-*-600 border-*-200
 * Use BADGE_COLORS for small pill badges; use STAT_COLORS for panel backgrounds.
 */
export const STAT_COLORS = {
  neutral:
    'bg-surface-raised/40 text-fg-secondary border-default dark:bg-surface-raised dark:text-fg-secondary dark:border-default',
  info: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900',
  amber:
    'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  success: 'bg-status-positive-subtle text-status-positive border-status-positive/20',
  tiffany:
    'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
} as const;

export type StatColorKey = keyof typeof STAT_COLORS;

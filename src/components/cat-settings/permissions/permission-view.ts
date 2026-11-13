/**
 * What the permission screens say about the current choices: pure functions,
 * so the words and the confirmation rules are tested without a browser.
 *
 * None of this changes what a permission allows. It decides how a category
 * reads (off, some on, all on), which preset the choices match, and when a
 * tap needs a second look before it widens what Cat may do.
 */

import { CAT_SPENDING_ACTION_IDS } from '@/config/cat-actions';
import { PERMISSION_PRESETS, presetAllows, type PermissionPreset } from '@/config/cat-autonomy';
import type { Action, CategorySummary } from './types';

export type CategoryState = 'off' | 'partial' | 'on';

export function categoryState(cat: CategorySummary): CategoryState {
  if (cat.enabledActionCount <= 0) {
    return 'off';
  }
  return cat.enabledActionCount < cat.actionCount ? 'partial' : 'on';
}

/** "2 of 8 on": the count in words, never a bare fraction. */
export function categoryCountLabel(cat: CategorySummary): string {
  return `${cat.enabledActionCount} of ${cat.actionCount} on`;
}

export function actionsOn(actions: readonly Action[]): Action[] {
  return actions.filter(a => a.autonomy !== 'off');
}

/**
 * The line under a category's name. A partly-on category names what is on,
 * so "Payments" on a new account does not read as "Cat can send Bitcoin".
 */
export function categoryDetail(cat: CategorySummary, actions: readonly Action[]): string {
  if (categoryState(cat) !== 'partial') {
    return cat.description;
  }
  const on = actionsOn(actions).map(a => a.name);
  return on.length > 0 ? `On: ${on.join(', ')}` : cat.description;
}

/** Categories that start open: the partly-on ones, so a reader sees what is on. */
export function initiallyExpanded(categories: readonly CategorySummary[]): Set<string> {
  return new Set(categories.filter(c => categoryState(c) === 'partial').map(c => c.category));
}

/**
 * Turning a whole category on that lets Cat move money takes a confirmation.
 * Turning anything off never does.
 */
export function needsConfirmToTurnOn(actions: readonly Action[], on: boolean): boolean {
  if (!on) {
    return false;
  }
  return actions.some(a => CAT_SPENDING_ACTION_IDS.includes(a.id) && a.autonomy === 'off');
}

export interface HighRiskNotice {
  tone: 'neutral' | 'warning';
  text: string;
}

/**
 * Names the high-risk actions that are on. Warning tone only when one of them
 * spends the person's Bitcoin; otherwise a plain note.
 */
export function highRiskNotice(actions: readonly Action[]): HighRiskNotice | null {
  const on = actionsOn(actions).filter(a => a.riskLevel === 'high');
  if (on.length === 0) {
    return null;
  }
  const names = on.map(a => a.name);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const verb = names.length === 1 ? 'is' : 'are';
  const spends = on.some(a => CAT_SPENDING_ACTION_IDS.includes(a.id));
  return {
    tone: spends ? 'warning' : 'neutral',
    text: `${list} ${verb} on. Cat always asks you first.`,
  };
}

/** The preset the current choices match, or null for a custom mix. */
export function activePreset(categories: readonly CategorySummary[]): PermissionPreset | null {
  return (
    PERMISSION_PRESETS.find(preset =>
      categories.every(cat => {
        const state = categoryState(cat);
        return presetAllows(preset, cat.category) ? state === 'on' : state === 'off';
      })
    ) ?? null
  );
}

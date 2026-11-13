/**
 * How the permission screens read the current choices. A brand-new account
 * (two harmless payment actions on by default) used to see Payments switched
 * on under "Send Bitcoin and fund projects", "2/8", and a warning that
 * something high-risk was enabled. These pin the words and the one place a
 * tap asks before it widens what Cat may do.
 */
import { describe, expect, it } from 'vitest';
import { ACTION_CATEGORIES, CAT_ACTIONS, CAT_SPENDING_ACTION_IDS } from '@/config/cat-actions';
import { PERMISSION_PRESET_ORDER, PERMISSION_PRESETS, presetAllows } from '@/config/cat-autonomy';
import { DEFAULT_ACTION_PERMISSIONS } from '@/services/cat/effective-permission';
import {
  activePreset,
  categoryCountLabel,
  categoryDetail,
  categoryState,
  highRiskNotice,
  initiallyExpanded,
  needsConfirmToTurnOn,
} from '@/components/cat-settings/permissions/permission-view';
import type { Action, CategorySummary } from '@/components/cat-settings/permissions/types';

const enabledActions = Object.values(CAT_ACTIONS).filter(a => a.enabled);

function actionsWith(on: (id: string, category: string) => boolean): Action[] {
  return enabledActions.map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    category: a.category,
    riskLevel: a.riskLevel,
    requiresConfirmation: a.requiresConfirmation,
    autonomy: on(a.id, a.category) ? 'ask' : 'off',
  }));
}

function summarize(actions: Action[]): CategorySummary[] {
  return Object.entries(ACTION_CATEGORIES).map(([category, meta]) => {
    const inCat = actions.filter(a => a.category === category);
    const count = inCat.filter(a => a.autonomy !== 'off').length;
    return {
      category,
      name: meta.name,
      description: meta.description,
      enabled: count > 0,
      actionCount: inCat.length,
      enabledActionCount: count,
    };
  });
}

// What a new account effectively has: memory and notes on, plus the two
// default payment actions.
const fresh = actionsWith(
  (id, category) => category === 'context' || !!DEFAULT_ACTION_PERMISSIONS[id]
);
const freshSummary = summarize(fresh);
const payments = freshSummary.find(c => c.category === 'payments')!;

describe('a brand-new account', () => {
  it('reads Payments as partly on, in words', () => {
    expect(categoryState(payments)).toBe('partial');
    expect(categoryCountLabel(payments)).toBe(`2 of ${payments.actionCount} on`);
  });

  it('names what is on instead of describing the whole category', () => {
    const detail = categoryDetail(
      payments,
      fresh.filter(a => a.category === 'payments')
    );
    expect(detail).toBe('On: Connect Wallet, Explain Transaction');
  });

  it('opens the partly-on category so the reader sees what is on', () => {
    expect([...initiallyExpanded(freshSummary)]).toEqual(['payments']);
  });

  it('gets a plain note, not a warning, naming the high-risk actions that are on', () => {
    expect(highRiskNotice(fresh)).toEqual({
      tone: 'neutral',
      text: 'Publish Interest and Connect Wallet are on. Cat always asks you first.',
    });
    expect(highRiskNotice(actionsWith(id => id === 'connect_wallet'))?.text).toBe(
      'Connect Wallet is on. Cat always asks you first.'
    );
  });

  it('is a custom mix, not a preset', () => {
    expect(activePreset(freshSummary)).toBeNull();
  });
});

describe('spending', () => {
  it('names only actions that exist in Payments', () => {
    for (const id of CAT_SPENDING_ACTION_IDS) {
      expect(CAT_ACTIONS[id]?.category).toBe('payments');
    }
  });

  it('warns when an action that spends Bitcoin is on', () => {
    const spending = actionsWith(id => id === 'send_payment');
    expect(highRiskNotice(spending)?.tone).toBe('warning');
  });

  it('asks before turning on a category that would let Cat spend', () => {
    expect(
      needsConfirmToTurnOn(
        fresh.filter(a => a.category === 'payments'),
        true
      )
    ).toBe(true);
  });

  it('never asks before turning something off', () => {
    expect(
      needsConfirmToTurnOn(
        fresh.filter(a => a.category === 'payments'),
        false
      )
    ).toBe(false);
  });

  it('does not ask for a category with nothing that spends', () => {
    expect(
      needsConfirmToTurnOn(
        fresh.filter(a => a.category === 'context'),
        true
      )
    ).toBe(false);
  });
});

describe('presets', () => {
  it('lists every preset exactly once', () => {
    expect([...PERMISSION_PRESET_ORDER].sort()).toEqual([...PERMISSION_PRESETS].sort());
  });

  it.each(PERMISSION_PRESETS)('recognises the choices %s writes', preset => {
    const applied = summarize(actionsWith((_id, category) => presetAllows(preset, category)));
    expect(activePreset(applied)).toBe(preset);
  });
});

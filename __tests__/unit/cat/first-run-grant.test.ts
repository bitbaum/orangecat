import { describe, it, expect } from 'vitest';
import { CAT_ACTIONS, ACTION_CATEGORIES, ACTION_CATEGORY_KEYS } from '@/config/cat-actions';
import { DEFAULT_PERMISSIONS } from '@/services/cat/permission-service';
import { summariseForModel } from '@/services/cat/action-loop';
import { canGrantOnConfirm } from '@/services/cat/action-types';

/**
 * ADR-0006 D5 — a first run that can do something.
 *
 * The consent card ("Allow and confirm") shipped as grant-on-confirm. What was
 * missing was the other half of the conversation: the model was told a plain
 * "waiting for confirmation" and announced a done deal, while the card asked
 * for a permission the reply never mentioned. Plus two measured corrections:
 * update_profile was default-on with no confirmation, and 'settings' was a
 * permission switch governing zero actions.
 */

describe('a permission category is never empty', () => {
  // The class, not the instance: 'settings' existed for months with no action
  // in it — a switch in the UI that governed nothing. Any category listed
  // must have at least one enabled action, or it is UI without a referent.
  const enabled = Object.values(CAT_ACTIONS).filter(a => a.enabled);

  it.each(ACTION_CATEGORY_KEYS)('%s governs at least one enabled action', category => {
    expect(enabled.some(a => a.category === category)).toBe(true);
  });

  it('has no settings category anywhere the app reads', () => {
    expect(Object.keys(ACTION_CATEGORIES)).not.toContain('settings');
    expect(Object.keys(DEFAULT_PERMISSIONS)).not.toContain('settings');
    expect(enabled.some(a => (a.category as string) === 'settings')).toBe(false);
  });

  it('defaults are declared for exactly the categories that exist', () => {
    // A default for a category that does not exist is the same drift in the
    // other direction.
    for (const key of Object.keys(DEFAULT_PERMISSIONS)) {
      expect(ACTION_CATEGORY_KEYS).toContain(key);
    }
  });
});

describe('update_profile is an entity action, not free context', () => {
  const action = CAT_ACTIONS.update_profile;

  it('is default-off and confirmed every time', () => {
    expect(action.category).toBe('entities');
    expect(action.requiresConfirmation).toBe(true);
    expect(DEFAULT_PERMISSIONS.entities).toBe(false);
  });

  it('still reaches a new user through the consent card rather than a dead end', () => {
    // Medium risk, not payments: the first use is a question, not a refusal.
    expect(canGrantOnConfirm(action, 'permission_denied')).toBe(true);
  });
});

describe('what the model is told when permission is the blocker', () => {
  it('asks for the grant by name when the card is a consent card', () => {
    const out = summariseForModel('create_product', {
      status: 'pending_confirmation',
      data: { description: 'Create product "Mugs"', pendingAction: { grantOnConfirm: true } },
    });
    expect(out).toContain('NOT YET ALLOWED');
    expect(out).toContain('Entities actions');
    expect(out).toContain('one tap allows it');
    expect(out).toContain('Nothing has been created or changed');
    expect(out).not.toContain('it is ready');
  });

  it('keeps the plain wording for an ordinary confirmation', () => {
    const out = summariseForModel('create_product', {
      status: 'pending_confirmation',
      data: { description: 'Create product "Mugs"', pendingAction: { grantOnConfirm: false } },
    });
    expect(out).toContain('WAITING FOR THE USER TO CONFIRM');
    expect(out).not.toContain('NOT YET ALLOWED');
  });

  it('names the category to allow on a hard denial instead of "what to grant"', () => {
    const out = summariseForModel('send_payment', {
      status: 'denied',
      error: 'Permission not granted',
    });
    expect(out).toContain('NOT PERMITTED');
    expect(out).toContain('allow Payments actions in their Cat settings');
    expect(out).not.toContain('tell the user what to grant');
  });

  it('still says something useful for an action the registry does not know', () => {
    const out = summariseForModel('not_a_real_action', { status: 'denied' });
    expect(out).toContain('tell the user what to grant');
  });
});

import {
  toAutonomyLevel,
  fromAutonomyLevel,
  allowedLevelsForRisk,
  AUTONOMY_LEVELS,
} from '@/config/cat-autonomy';
import { CAT_ACTIONS } from '@/config/cat-actions';
import { defaultAllowedFor } from '@/services/cat/permission-service';

/**
 * The autonomy ladder maps three human levels onto the two booleans the
 * database has always stored. Round-tripping must be lossless, and money
 * actions must never be settable to "Automatic" — the UI hides it and the
 * API forces confirmation, so both halves are pinned here.
 */

describe('autonomy level mapping', () => {
  it('round-trips every level', () => {
    for (const level of AUTONOMY_LEVELS) {
      const { granted, requiresConfirmation } = fromAutonomyLevel(level);
      expect(toAutonomyLevel(granted, requiresConfirmation)).toBe(level);
    }
  });

  it('reads stored booleans the way the executor resolves them', () => {
    expect(toAutonomyLevel(false, true)).toBe('off');
    expect(toAutonomyLevel(false, false)).toBe('off');
    expect(toAutonomyLevel(true, true)).toBe('ask');
    expect(toAutonomyLevel(true, false)).toBe('auto');
    // A null requires_confirmation means "fall back to confirming".
    expect(toAutonomyLevel(true, null)).toBe('ask');
    expect(toAutonomyLevel(null, null)).toBe('off');
  });

  it('never offers Automatic for high-risk actions', () => {
    expect(allowedLevelsForRisk('high')).toEqual(['off', 'ask']);
    expect(allowedLevelsForRisk('medium')).toContain('auto');
    expect(allowedLevelsForRisk('low')).toContain('auto');
  });

  it('every money-moving action is high risk (so it always confirms)', () => {
    const moneyMovers = ['send_payment', 'fund_project', 'book_service'];
    for (const id of moneyMovers) {
      expect(CAT_ACTIONS[id]?.riskLevel).toBe('high');
      expect(allowedLevelsForRisk(CAT_ACTIONS[id].riskLevel)).not.toContain('auto');
    }
  });
});

/**
 * Shipped defaults decide what a brand-new account can actually do. The
 * payments category is off by default, correctly — but that swept up
 * connect_wallet, the action that makes a profile payable in the first place.
 * A user would have had to unlock the whole payments category (send_payment
 * included) just to tell us where to send their money, which is a worse
 * security posture than granting the harmless action alone.
 */
describe('shipped permission defaults', () => {
  it('lets a new user connect a receiving wallet without unlocking payments', () => {
    expect(defaultAllowedFor('connect_wallet', 'payments')).toBe(true);
    // Still confirmed — this is where money lands, so a tap is required.
    expect(CAT_ACTIONS.connect_wallet.requiresConfirmation).toBe(true);
    expect(allowedLevelsForRisk(CAT_ACTIONS.connect_wallet.riskLevel)).not.toContain('auto');
  });

  it('does not let anything that moves money default on', () => {
    const defaultedOn = Object.values(CAT_ACTIONS).filter(
      a => a.enabled && a.category === 'payments' && defaultAllowedFor(a.id, a.category)
    );
    // Both are in the payments category and neither moves money: connect_wallet
    // sets where the user's own money arrives, note_transaction writes the
    // owner's note on their own transaction. Each still requires confirmation.
    expect(defaultedOn.map(a => a.id).sort()).toEqual(['connect_wallet', 'note_transaction']);
    for (const a of defaultedOn) {
      expect(a.requiresConfirmation).toBe(true);
    }
  });

  it('leaves every other category default untouched', () => {
    expect(defaultAllowedFor('send_payment', 'payments')).toBe(false);
    expect(defaultAllowedFor('add_wallet', 'payments')).toBe(false);
    expect(defaultAllowedFor('create_product', 'entities')).toBe(false);
    expect(defaultAllowedFor('add_context', 'context')).toBe(true);
  });
});

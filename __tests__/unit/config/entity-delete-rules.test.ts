/**
 * A published event cannot be deleted (RLS: "Users can delete their own draft
 * events"). The app has to know that, or Delete reports success while the
 * event stays live with tickets on sale.
 */
import {
  canDeleteInStatus,
  getAllowedStatusTransitions,
  takeDownStatus,
} from '@/config/entity-status';
import { STATUS } from '@/config/database-constants';

describe('entity delete rules', () => {
  it('an event deletes only as a draft', () => {
    expect(canDeleteInStatus('event', STATUS.EVENTS.DRAFT)).toBe(true);
    for (const s of ['published', 'open', 'full', 'ongoing', 'completed', 'cancelled']) {
      expect(canDeleteInStatus('event', s)).toBe(false);
    }
    expect(canDeleteInStatus('event', undefined)).toBe(false);
  });

  it('a type without a rule deletes in any status', () => {
    expect(canDeleteInStatus('product', 'active')).toBe(true);
    expect(canDeleteInStatus('product', undefined)).toBe(true);
  });

  it('every live event status has a way offline, and each move is an allowed transition', () => {
    for (const s of ['published', 'open', 'full', 'ongoing', 'completed', 'cancelled']) {
      const next = takeDownStatus(s);
      expect(next).not.toBeNull();
      expect(getAllowedStatusTransitions(s)).toContain(next);
    }
    expect(takeDownStatus('published')).toBe('draft');
    expect(takeDownStatus('full')).toBe('cancelled');
    // cancelled can go back to draft, so a full event reaches deletable in two moves
    expect(takeDownStatus('cancelled')).toBe('draft');
    expect(takeDownStatus(null)).toBeNull();
  });
});

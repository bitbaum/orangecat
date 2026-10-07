/**
 * How a public review reads on a profile (ADR-0010): anonymous unless the
 * reviewer chose otherwise, hidden text stays visibly hidden, the seller's
 * reply rides along.
 */

import { toPublicReview, type PublicReviewRow } from '@/domain/reputation/track-record';
import { NOTIFICATION_CONFIG } from '@/config/notification-config';
import type { ActorName } from '@/domain/actors/names';

const row = (overrides: Partial<PublicReviewRow> = {}): PublicReviewRow => ({
  review_id: 'r1',
  answers: { would_deal_again: true },
  body: 'Great',
  text_hidden: false,
  created_at: '2026-10-06T00:00:00Z',
  reviewer_actor_id: null,
  reply_body: null,
  reply_hidden: null,
  reply_created_at: null,
  ...overrides,
});

const names = new Map<string, ActorName>([
  ['a1', { actor_id: 'a1', name: 'Lena', username: 'lena' }],
]);

describe('toPublicReview', () => {
  it('is anonymous when the reviewer did not choose to be named', () => {
    expect(toPublicReview(row(), names).reviewer).toBeNull();
  });

  it('names the reviewer who chose it', () => {
    expect(toPublicReview(row({ reviewer_actor_id: 'a1' }), names).reviewer?.name).toBe('Lena');
  });

  it('keeps a hidden review visibly hidden rather than silently empty', () => {
    const r = toPublicReview(row({ body: null, text_hidden: true }), names);
    expect(r.body).toBeNull();
    expect(r.textHidden).toBe(true);
  });

  it('carries the seller’s reply', () => {
    const r = toPublicReview(
      row({ reply_body: 'Thanks!', reply_hidden: false, reply_created_at: '2026-10-07T00:00:00Z' }),
      names
    );
    expect(r.reply).toEqual({ body: 'Thanks!', hidden: false, created_at: '2026-10-07T00:00:00Z' });
  });

  it('has no reply when none was written', () => {
    expect(toPublicReview(row(), names).reply).toBeNull();
  });
});

describe('review emails respect the person', () => {
  const config = NOTIFICATION_CONFIG.deal_review;

  it('can be switched off', () => {
    expect(config.canOptOut).toBe(true);
  });

  it('is capped per day', () => {
    expect(config.frequencyCap?.maxPerDay).toBeGreaterThan(0);
  });
});

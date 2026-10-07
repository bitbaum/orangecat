/**
 * A place set up for someone (a studio for a DJ who is not on the platform yet)
 * must be findable on their page and show what happens in it.
 */
import { UNCLAIMED_LISTING_TYPES } from '@/domain/profileClaims/unclaimedListings';
import { UPCOMING_EVENT_STATUSES } from '@/components/public/detail-configs/AssetEventsCard';
import { PROFILE_LISTING_COUNT_CONFIG } from '@/services/profile/listingCounts';
import { ENTITY_REGISTRY } from '@/config/entity-registry';

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));

describe('an unclaimed page lists more than projects', () => {
  it('includes assets and projects, all owned by actor', () => {
    expect(UNCLAIMED_LISTING_TYPES).toEqual(expect.arrayContaining(['project', 'asset']));
    for (const type of UNCLAIMED_LISTING_TYPES) {
      expect(ENTITY_REGISTRY[type].userIdField).toBe('actor_id');
    }
  });
});

describe('the asset badge counts what the Assets tab lists', () => {
  it('matches the registry owner field, not the legacy owner_id', () => {
    const asset = PROFILE_LISTING_COUNT_CONFIG.find(c => c.type === 'asset');
    expect(asset?.userField).toBe(ENTITY_REGISTRY.asset.userIdField);
  });
});

describe('"Happening here" shows only events a visitor can still go to', () => {
  it('never lists a draft, cancelled or finished event', () => {
    for (const hidden of ['draft', 'cancelled', 'completed']) {
      expect(UPCOMING_EVENT_STATUSES).not.toContain(hidden);
    }
    expect(UPCOMING_EVENT_STATUSES).toContain('published');
  });
});

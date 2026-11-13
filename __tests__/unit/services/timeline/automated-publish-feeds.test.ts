/**
 * The public /community feed and a newcomer's "From people on OrangeCat"
 * preview were Loki's build log ("orangecat: e2e ok — no changes"). Automated
 * publishes stay on the project's wall; what people post still shows.
 */

const orFilter = vi.fn();
const builder: Record<string, unknown> = {};
builder.select = vi.fn(() => builder);
builder.or = vi.fn((...args: unknown[]) => {
  orFilter(...args);
  return builder;
});
builder.order = vi.fn(() => builder);
builder.range = vi.fn(async () => ({ data: [], error: null, count: 0 }));

vi.mock('@/lib/supabase/browser', () => ({ default: { from: vi.fn(() => builder) } }));
vi.mock('@/services/timeline/queries/helpers', () => ({
  displayEventsFromView: vi.fn(async () => []),
}));

import { EXCLUDE_AUTOMATED_PUBLISH_OR_FILTER, isAutomatedPublish } from '@/config/external-publish';
import { getCommunityFeed } from '@/services/timeline/queries/communityFeeds';
import { withoutOthersAutomatedPublishes } from '@/app/(authenticated)/dashboard/useDashboardTimeline';
import type { TimelineDisplayEvent, TimelineFeedResponse } from '@/types/timeline';

const loki = { is_external_publish: true, source: 'loki', external_id: 'run-1' };

describe('isAutomatedPublish', () => {
  it('is true for a Loki build update', () => {
    expect(isAutomatedPublish(loki)).toBe(true);
  });

  it('is false for a person’s post, and for one an AI app made at a person’s request', () => {
    expect(isAutomatedPublish({ is_user_post: true })).toBe(false);
    expect(isAutomatedPublish({ is_external_publish: true, source: 'ai_app' })).toBe(false);
    expect(isAutomatedPublish(null)).toBe(false);
    // `source` without the external flag is not the bus.
    expect(isAutomatedPublish({ source: 'loki' })).toBe(false);
  });
});

describe('getCommunityFeed', () => {
  it('asks the view for everything but automated publishes, keeping posts with no source', async () => {
    await getCommunityFeed();
    expect(orFilter).toHaveBeenCalledWith(EXCLUDE_AUTOMATED_PUBLISH_OR_FILTER);
    expect(EXCLUDE_AUTOMATED_PUBLISH_OR_FILTER).toBe(
      'metadata->>source.is.null,metadata->>source.not.in.(loki)'
    );
  });
});

describe('withoutOthersAutomatedPublishes', () => {
  const event = (id: string, actorId: string, metadata: Record<string, unknown>) =>
    ({ id, actorId, metadata }) as unknown as TimelineDisplayEvent;
  const feed = (events: TimelineDisplayEvent[]) => ({ events }) as unknown as TimelineFeedResponse;

  it('drops someone else’s build updates and keeps people’s posts and the viewer’s own', () => {
    const result = withoutOthersAutomatedPublishes(
      feed([
        event('a', 'cato', loki),
        event('b', 'someone', { is_user_post: true }),
        event('c', 'me', loki),
      ]),
      'me'
    );
    expect(result.events.map(e => e.id)).toEqual(['b', 'c']);
  });

  it('returns the same feed when there is nothing to drop', () => {
    const same = feed([event('b', 'someone', { is_user_post: true })]);
    expect(withoutOthersAutomatedPublishes(same, 'me')).toBe(same);
  });
});

describe('a QA run’s posts stay off the community feed', () => {
  it('drops authors whose display name is a fixture name, keeps unnamed ones', async () => {
    const { NOT_A_FIXTURE_AUTHOR } = await import('@/domain/people/publicPeopleFilter');
    expect(NOT_A_FIXTURE_AUTHOR.startsWith('actor_data->>display_name.is.null,')).toBe(true);
    expect(NOT_A_FIXTURE_AUTHOR).toContain('actor_data->>display_name.not.imatch.');
    const { FIXTURE_DISPLAY_NAME_PATTERN } = await import('@/config/public-directory');
    const fixture = new RegExp(FIXTURE_DISPLAY_NAME_PATTERN, 'i');
    expect(fixture.test('QA Grok A')).toBe(true);
    expect(fixture.test('Penguin')).toBe(false);
  });
});

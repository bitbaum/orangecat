/**
 * The bell's Payments / Social / Messages filters are categories. They used to
 * match one literal type each, so Payments hid "Someone tried to tip you
 * Bitcoin" (tip_dead_end) and Social never showed a mention or a comment.
 */
import {
  IN_APP_NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_CATEGORY,
  matchesNotificationFilter,
  notificationTypesIn,
} from '@/config/notification-types';

describe('notification filter categories', () => {
  it('every type has a category', () => {
    for (const type of IN_APP_NOTIFICATION_TYPES) {
      expect(NOTIFICATION_TYPE_CATEGORY[type]).toBeDefined();
    }
  });

  it('Payments covers a tip and a ticket, Social a mention and a group invite', () => {
    expect(notificationTypesIn('payments')).toEqual(
      expect.arrayContaining(['payment', 'tip_dead_end', 'project_funded', 'ticket'])
    );
    expect(notificationTypesIn('social')).toEqual(
      expect.arrayContaining(['follow', 'mention', 'comment', 'group_invite'])
    );
    expect(notificationTypesIn('messages')).toEqual(['message']);
  });

  it('a live arrival is matched by the same rule the API filters with', () => {
    const tip = { type: 'tip_dead_end', is_read: false };
    expect(matchesNotificationFilter(tip, 'payments')).toBe(true);
    expect(matchesNotificationFilter(tip, 'social')).toBe(false);
    expect(matchesNotificationFilter(tip, 'all')).toBe(true);
    expect(matchesNotificationFilter(tip, 'unread')).toBe(true);
    expect(matchesNotificationFilter({ ...tip, is_read: true }, 'unread')).toBe(false);
    expect(matchesNotificationFilter(tip, 'tip_dead_end')).toBe(true);
  });
});

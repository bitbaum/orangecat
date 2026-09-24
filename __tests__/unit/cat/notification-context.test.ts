/**
 * Notifications in the Cat's assistance scope:
 *  - coalesceNotifications collapses repeated alerts (same type+title) into one
 *    summary with a count, so 18 nightly eval failures read as ONE problem ×18
 *  - renderNotifications formats the coalesced groups for the context string
 */
import {
  coalesceNotifications,
  type NotificationRow,
} from '@/services/ai/notification-context-fetcher';
import { renderNotifications } from '@/services/ai/context-sections';

const row = (overrides: Partial<NotificationRow> = {}): NotificationRow => ({
  type: 'system',
  message:
    'Nightly Cat eval could not complete — 8/8 probe(s) failed at the provider layer; judgment score is invalid.',
  action_url: null,
  created_at: '2026-07-22T04:30:00Z',
  metadata: { title: 'Cat eval harness error' },
  ...overrides,
});

describe('coalesceNotifications', () => {
  it('collapses repeated alerts with the same type+title into one group with a count', () => {
    const rows = [
      row({ created_at: '2026-07-22T04:30:00Z' }),
      row({ created_at: '2026-07-21T04:30:00Z' }),
      row({ created_at: '2026-07-20T04:30:00Z' }),
    ];
    const groups = coalesceNotifications(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(3);
    // Rows arrive newest-first, so the group keeps the newest timestamp.
    expect(groups[0].latest_at).toBe('2026-07-22T04:30:00Z');
    expect(groups[0].title).toBe('Cat eval harness error');
  });

  it('keeps distinct titles as separate groups, in newest-first order', () => {
    const rows = [
      row({ metadata: { title: 'Cat eval regression' }, created_at: '2026-07-22T04:30:00Z' }),
      row({ created_at: '2026-07-21T04:30:00Z' }),
      row({ created_at: '2026-07-20T04:30:00Z' }),
    ];
    const groups = coalesceNotifications(rows);
    expect(groups.map(g => g.title)).toEqual(['Cat eval regression', 'Cat eval harness error']);
    expect(groups[1].count).toBe(2);
  });

  it('falls back to the message as title when metadata has none', () => {
    const groups = coalesceNotifications([
      row({ metadata: null, message: 'Payment received' }),
      row({ metadata: {}, message: 'Payment received' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('Payment received');
  });

  it('does not merge same title across different types', () => {
    const groups = coalesceNotifications([row({ type: 'system' }), row({ type: 'payment' })]);
    expect(groups).toHaveLength(2);
  });
});

describe('renderNotifications', () => {
  it('returns null when there is nothing to show', () => {
    expect(renderNotifications(undefined, 'en-US')).toBeNull();
    expect(renderNotifications([], 'en-US')).toBeNull();
  });

  it('renders coalesced groups with ×N counts and truncated messages', () => {
    const out = renderNotifications(
      coalesceNotifications([row(), row({ created_at: '2026-07-21T04:30:00Z' })]),
      'en-US'
    );
    expect(out).toContain('## Unread Platform Notifications');
    expect(out).toContain('**Cat eval harness error** ×2');
    expect(out).toContain('[system]');
    expect(out).toContain('latest Jul 22, 2026');
  });

  it('states the exact total the bell shows, not a sum of the fetched groups', () => {
    // 80 unread, but only the newest few were fetched and coalesced: the Cat
    // said "30" beside a bell panel that said 80.
    const out = renderNotifications(coalesceNotifications([row(), row()]), 'en-US', 80);
    expect(out).toContain('Total unread: 80');
  });

  it('omits the count and preview for single, message-only notifications', () => {
    const out = renderNotifications(
      coalesceNotifications([row({ metadata: null, message: 'Payment received' })]),
      'en-US'
    );
    expect(out).toContain('**Payment received**');
    expect(out).not.toContain('×1');
    expect(out).not.toContain('— "');
  });
});

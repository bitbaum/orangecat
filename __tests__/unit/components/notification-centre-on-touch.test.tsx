// @vitest-environment jsdom
/**
 * The notification centre on a phone, measured on production at 390px with a
 * touch pointer (2026-11-12):
 *
 *  - every notification carried three buttons (Ask the Cat, Mark as read,
 *    Delete) at opacity 0. Tailwind puts `group-hover` behind
 *    `@media (hover: hover)`, so on a phone they never appeared, yet each was
 *    a live 44px target; Delete sat beside the unread dot, where a thumb opens
 *    the notification. Their 140px also pushed the title and message into a
 *    142px column (eight lines for one sentence).
 *  - the filter row (All, Unread, Payments, Social, Messages) was 378px of
 *    tabs in a 340px row: "Messages" ran 38px out of the pill and off the
 *    screen, and every tab was 32px tall.
 *
 * jsdom has no layout, so these pin the classes and structure that produce
 * the measured result; the layout itself was measured in Chromium.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import type { Notification } from '@/hooks/useNotifications';

vi.mock('@/components/messaging/MessagePanel', () => ({ default: () => null }));

const unread = {
  id: 'n1',
  type: 'tip_dead_end',
  message:
    'A visitor wanted to send you Bitcoin, but you do not have a wallet that can receive yet.',
  action_url: '/dashboard/wallets',
  is_read: false,
  read_at: null,
  created_at: new Date().toISOString(),
  metadata: { title: 'Someone tried to send you Bitcoin' },
} as Notification;

vi.mock('@/components/notifications/useNotificationCenter', () => ({
  useNotificationCenter: () => ({
    notifications: [unread],
    unreadCount: 1,
    isLoading: false,
    error: null,
    hasMore: false,
    loadMore: () => {},
    refresh: () => {},
    uiFilter: 'all',
    setUIFilter: () => {},
    showMessages: false,
    setShowMessages: () => {},
    handleMarkAsRead: () => {},
    handleMarkAllAsRead: () => {},
    handleDeleteNotification: () => {},
    handleClearRead: () => {},
    handleNotificationClick: () => {},
    handleAskCat: () => {},
  }),
}));

afterEach(cleanup);

function renderItem() {
  render(
    <NotificationItem
      notification={unread}
      onMarkAsRead={() => {}}
      onDelete={() => {}}
      onClick={() => {}}
      onAskCat={() => {}}
    />
  );
  const actions = screen.getByTitle('Delete notification').parentElement as HTMLElement;
  return { actions, classes: actions.className.split(/\s+/) };
}

describe('notification actions on a phone', () => {
  it('are hidden only where a mouse can hover them back into view', () => {
    const { classes } = renderItem();
    expect(classes).not.toContain('opacity-0');
    expect(classes).toContain('pointer-fine:opacity-0');
    expect(classes).toContain('group-hover:opacity-100');
  });

  it('show while one of them has keyboard focus', () => {
    const { classes } = renderItem();
    expect(classes).toContain('focus-within:opacity-100');
  });

  it('do not share a line with the words, so the title and message keep the full width', () => {
    const { actions } = renderItem();
    const line = actions.parentElement as HTMLElement;
    expect(within(line).queryByRole('heading')).toBeNull();
    expect(within(line).queryByText(unread.message)).toBeNull();
    for (const name of ['Ask the Cat about this', 'Mark as read', 'Delete notification']) {
      expect(screen.getByTitle(name).className).toMatch(/\bmin-h-11\b.*\bmin-w-11\b/);
    }
  });
});

describe('notification filters on a phone', () => {
  it('are one named row of 44px choices that scrolls sideways instead of spilling', () => {
    render(<NotificationCenter isOpen onClose={() => {}} />);
    const row = screen.getByRole('group', { name: 'Notification filter' });
    expect(row.className).toMatch(/\boverflow-x-auto\b/);

    const filters = within(row).getAllByRole('button');
    expect(filters.map(f => f.textContent)).toEqual([
      'All',
      'Unread',
      'Payments',
      'Social',
      'Messages',
    ]);
    for (const filter of filters) {
      expect(filter.className).toMatch(/\bmin-h-11\b/);
      expect(filter.className).toMatch(/\bmin-w-max\b/);
    }
    expect(within(row).getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});

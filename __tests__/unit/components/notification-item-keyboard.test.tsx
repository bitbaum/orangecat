// @vitest-environment jsdom
/**
 * A notification was a clickable div: no role, no tabindex, so a keyboard
 * could not open it, and nothing on it said what opening it does. The icon
 * buttons had a `title` only.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import type { Notification } from '@/hooks/useNotifications';

const tip = {
  id: 'n1',
  type: 'tip_dead_end',
  message: 'A visitor wanted to send you Bitcoin, but you have no wallet that can receive yet.',
  action_url: '/dashboard/wallets',
  is_read: false,
  read_at: null,
  created_at: new Date().toISOString(),
  metadata: { title: 'Someone tried to send you Bitcoin' },
} as Notification;

afterEach(cleanup);

function renderItem(n: Notification, onClick = vi.fn()) {
  render(
    <NotificationItem
      notification={n}
      onMarkAsRead={() => {}}
      onDelete={() => {}}
      onClick={onClick}
      onAskCat={() => {}}
    />
  );
  return onClick;
}

describe('NotificationItem', () => {
  it('is a real button with a focus ring that says what it does', () => {
    const onClick = renderItem(tip);
    const open = screen.getByRole('button', { name: /someone tried to send you bitcoin/i });
    expect(open.tagName).toBe('BUTTON');
    expect(open.className).toMatch(/focus-visible:ring-2/);
    expect(open).toHaveTextContent('Add a wallet');
    fireEvent.click(open);
    expect(onClick).toHaveBeenCalledWith(tip);
  });

  it('names its icon buttons for a screen reader', () => {
    renderItem(tip);
    for (const name of ['Ask the Cat about this', 'Mark as read', 'Delete notification']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('promises no action when it leads nowhere', () => {
    renderItem({ ...tip, type: 'system', action_url: null } as Notification);
    expect(screen.queryByText('Open')).toBeNull();
  });
});

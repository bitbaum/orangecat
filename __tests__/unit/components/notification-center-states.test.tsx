// @vitest-environment jsdom
/**
 * The notifications panel shows one state at a time.
 *
 * A failed first load used to draw the error above the filter row and "No
 * notifications found" below it, which read as both; and the five filters were
 * a hand-built row that ran off a phone screen.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
let state: Record<string, unknown> = {};

vi.mock('@/components/notifications/useNotificationCenter', () => ({
  useNotificationCenter: () => state,
}));
vi.mock('@/components/messaging/MessagePanel', () => ({ default: () => null }));
vi.mock('@/components/notifications/NotificationItem', () => ({
  NotificationItem: ({ notification }: { notification: { title: string } }) => (
    <div>{notification.title}</div>
  ),
}));

import NotificationCenter from '@/components/notifications/NotificationCenter';

function base(overrides: Record<string, unknown>) {
  return {
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    error: null,
    hasMore: false,
    loadMore: vi.fn(),
    refresh,
    uiFilter: 'all',
    setUIFilter: vi.fn(),
    showMessages: false,
    setShowMessages: vi.fn(),
    handleMarkAsRead: vi.fn(),
    handleMarkAllAsRead: vi.fn(),
    handleDeleteNotification: vi.fn(),
    handleClearRead: vi.fn(),
    handleNotificationClick: vi.fn(),
    handleAskCat: vi.fn(),
    ...overrides,
  };
}

describe('NotificationCenter states', () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  it('a failed first load is one state with a way to try again', () => {
    state = base({ error: new Error('PGRST301 JWT expired') });
    render(<NotificationCenter isOpen onClose={vi.fn()} />);

    expect(screen.getByText('Could not load your notifications.')).toBeInTheDocument();
    expect(screen.queryByText('No notifications found')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Show' })).not.toBeInTheDocument();
    expect(screen.queryByText(/PGRST/)).not.toBeInTheDocument();

    screen.getByRole('button', { name: 'Try again' }).click();
    expect(refresh).toHaveBeenCalled();
  });

  it('an empty list is the empty state, with the filters as one shared control', () => {
    state = base({});
    render(<NotificationCenter isOpen onClose={vi.fn()} />);

    expect(screen.getByText('No notifications found')).toBeInTheDocument();
    expect(screen.queryByText('Could not load your notifications.')).not.toBeInTheDocument();
    const filters = screen.getByRole('group', { name: 'Show' });
    expect(filters.querySelectorAll('button[aria-pressed]')).toHaveLength(5);
  });

  it('a failed refresh keeps the list and says so above it', () => {
    state = base({
      error: new Error('boom'),
      notifications: [{ id: '1', title: 'Paid' }],
    });
    render(<NotificationCenter isOpen onClose={vi.fn()} />);

    expect(screen.getByText('Could not refresh your notifications.')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });
});

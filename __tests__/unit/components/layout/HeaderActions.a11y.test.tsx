// @vitest-environment jsdom
/**
 * NotificationsButton — disclosure semantics for the bell that opens the
 * notification center dialog. Screen-reader users must know the button opens a
 * dialog and whether it's currently open.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotificationsButton } from '@/components/layout/HeaderActions';

let mockUnreadCount = 0;
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/stores/messaging', () => ({ useUnreadCount: () => 0 }));
vi.mock('@/hooks/useUnreadNotifications', () => ({
  useUnreadNotifications: () => ({ count: mockUnreadCount }),
}));

beforeEach(() => {
  mockUnreadCount = 0;
});

describe('NotificationsButton — a11y', () => {
  it('advertises a dialog popup and collapsed state by default', () => {
    render(<NotificationsButton onClick={() => {}} />);
    const btn = screen.getByRole('button', { name: /notifications/i });
    expect(btn).toHaveAttribute('aria-haspopup', 'dialog');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('reflects the open state via aria-expanded', () => {
    render(<NotificationsButton onClick={() => {}} isOpen />);
    const btn = screen.getByRole('button', { name: /notifications/i });
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });

  it('exposes the unread count in its accessible name', () => {
    mockUnreadCount = 3;
    render(<NotificationsButton onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /3 unread/i })).toBeInTheDocument();
  });
});

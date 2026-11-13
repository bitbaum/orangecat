// @vitest-environment jsdom
/**
 * The sidebar never told assistive tech which page you are on (orangecat.ch,
 * 2026-11-12); the phone tab bar did.
 */
import { render, screen } from '@testing-library/react';
import { Home } from 'lucide-react';
import { SidebarNavItem } from '@/components/sidebar/SidebarNavItem';

vi.mock('@/stores/messaging', () => ({ useUnreadCount: () => 0 }));

const item = { name: 'Home', href: '/dashboard', icon: Home } as never;

describe('a sidebar link', () => {
  it('is marked as the current page when it is', () => {
    render(<SidebarNavItem item={item} isActive isExpanded onNavigate={() => {}} />);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  });

  it('is not marked otherwise', () => {
    render(<SidebarNavItem item={item} isActive={false} isExpanded onNavigate={() => {}} />);
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });
});

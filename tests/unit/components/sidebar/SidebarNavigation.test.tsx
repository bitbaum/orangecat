// @vitest-environment jsdom
/**
 * SidebarNavigation — section headers must be controls, and a toggle must toggle.
 *
 * George reported clicking "Fund" / "Coordinate" / "Finance" did nothing: the
 * label was an <h3> and only the small chevron beside it carried the onClick.
 * This is the second time this class landed in the same sidebar (see
 * ContextSwitcher.test.tsx — "the avatar must be a control, not a dead pixel"),
 * so it gets a guard rather than a third fix.
 *
 * Three assertions, one per way the toggle used to lie to the user:
 *  1. the whole header row is one control — clicking the WORD toggles
 *  2. an explicit collapse wins even when the section holds the active page
 *  3. the chevron's state matches what is actually rendered (aria-expanded)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Home } from 'lucide-react';
import { SidebarNavigation } from '@/components/sidebar/SidebarNavigation';
import type { NavSection } from '@/hooks/useNavigation';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/projects',
}));

vi.mock('@/stores/messaging', () => ({
  useUnreadCount: () => 0,
}));

const SECTIONS: NavSection[] = [
  {
    id: 'main',
    title: '',
    priority: 1,
    collapsible: false,
    items: [{ name: 'Home', href: '/dashboard', icon: Home }],
  },
  {
    id: 'fund',
    title: 'Fund',
    priority: 3,
    collapsible: true,
    items: [{ name: 'Projects', href: '/projects', icon: Home }],
  },
];

// /projects is active — it lives inside the collapsible "Fund" section
const isItemActive = (href: string) => href === '/projects';

function renderNav(collapsed: string[], toggleSection = vi.fn()) {
  const view = render(
    <SidebarNavigation
      sections={SECTIONS}
      bottomItems={[]}
      isExpanded
      collapsedSections={new Set(collapsed)}
      isItemActive={isItemActive}
      toggleSection={toggleSection}
    />
  );
  return { toggleSection, ...view };
}

describe('SidebarNavigation section headers', () => {
  it('toggles when the section WORD is clicked, not just the chevron', () => {
    const { toggleSection } = renderNav([]);

    // The label itself must sit inside a real control.
    const header = screen.getByRole('heading', { name: 'Fund' });
    const control = header.closest('button');
    expect(control).not.toBeNull();

    fireEvent.click(header);
    expect(toggleSection).toHaveBeenCalledWith('fund');
  });

  it('honours an explicit collapse even when the section holds the active page', () => {
    renderNav(['fund']);

    // "Projects" is the active route; collapsing "Fund" used to be a no-op
    // because an active child forced the list to stay rendered.
    expect(screen.queryByText('Projects')).not.toBeInTheDocument();
  });

  it('reports expanded state that matches what is rendered', () => {
    const { unmount } = renderNav(['fund']);
    expect(screen.getByRole('heading', { name: 'Fund' }).closest('button')).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    unmount();

    renderNav([]);
    expect(screen.getByRole('heading', { name: 'Fund' }).closest('button')).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });
});

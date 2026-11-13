// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Sidebar } from '@/components/sidebar/Sidebar';

vi.mock('@/hooks/useMediaQuery', () => ({ useIsDesktop: () => false }));
vi.mock('@/components/sidebar/SidebarNavigation', () => ({
  SidebarNavigation: () => <a href="/messages">Drawer messages</a>,
}));
vi.mock('@/components/sidebar/ContextSwitcher', () => ({ ContextSwitcher: () => null }));

afterEach(cleanup);

it('removes closed phone navigation from the accessibility tree and tab order', () => {
  const { container } = renderSidebar(false);
  expect(screen.queryByRole('link', { name: 'Drawer messages' })).toBeNull();
  expect(container.querySelector('aside')).toHaveAttribute('inert');
});

it('exposes the open navigation and closes it with Escape', () => {
  const toggleSidebar = vi.fn();
  const { container } = renderSidebar(true, toggleSidebar);
  expect(screen.getByRole('link', { name: 'Drawer messages' })).toBeVisible();
  expect(container.querySelector('aside')).not.toHaveAttribute('inert');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(toggleSidebar).toHaveBeenCalledOnce();
});

it('places the drawer by the shared rule, and on top of the tab bar where it shows', () => {
  // Where it ends and starts is .app-sidebar in globals.css, measured in
  // __tests__/unit/app/safe-area-insets.test.ts. An inline top or bottom here
  // would beat it: the drawer ran under the tab bar and 8px below the header.
  const withBar = renderSidebar(true, vi.fn(), true).container.querySelector('aside')!;
  expect(withBar).toHaveClass('app-sidebar');
  expect(withBar).not.toHaveClass('bottom-0');
  expect(withBar.style.top).toBe('');
  expect(withBar.style.bottom).toBe('');
  expect(withBar.style.paddingBottom).toBe('');
  expect(withBar).toHaveAttribute('data-above-mobile-nav');
  cleanup();

  // The Cat hub and the article editor have no tab bar: the drawer runs to the bottom.
  const noBar = renderSidebar(true).container.querySelector('aside')!;
  expect(noBar).not.toHaveAttribute('data-above-mobile-nav');
});

function renderSidebar(open: boolean, toggleSidebar = vi.fn(), aboveMobileNav?: boolean) {
  return render(
    <Sidebar
      user={null}
      profile={null}
      sections={[]}
      bottomItems={[]}
      navigationState={{
        isSidebarOpen: open,
        isSidebarCollapsed: false,
        collapsedSections: new Set(),
      }}
      isItemActive={() => false}
      toggleSidebar={toggleSidebar}
      toggleSidebarCollapse={vi.fn()}
      toggleSection={vi.fn()}
      aboveMobileNav={aboveMobileNav}
    />
  );
}

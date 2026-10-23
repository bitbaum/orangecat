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

function renderSidebar(open: boolean, toggleSidebar = vi.fn()) {
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
    />
  );
}

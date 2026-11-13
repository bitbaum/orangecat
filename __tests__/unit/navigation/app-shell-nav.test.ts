/**
 * The signed-in shell's navigation rules (UX/UI audit, app-shell findings).
 *
 * - A nav item owns the screens it stands for: Money is lit on Send and
 *   Requests, My things on every type's own list.
 * - The collapsed rail hides groups, so it must end with a way to reach them.
 * - Settings and Help live in the account menu, once, and the palette still
 *   finds them.
 */
import { describe, expect, it } from 'vitest';
import { isNavHrefActive } from '@/lib/navigation/isActive';
import { getVisibleSections } from '@/components/sidebar/SidebarNavigation';
import { accountNavItems, mobileTabBar, sidebarSections } from '@/config/navigation';
import { buildPages, rankItems } from '@/components/search/command-palette-items';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';
import type { NavSection } from '@/hooks/useNavigation';

const allItems = sidebarSections.flatMap(s => s.items);
const item = (href: string) => allItems.find(i => i.href === href);

describe('a nav item owns the screens it stands for', () => {
  it('matches activeFor paths with the same rules as href', () => {
    expect(isNavHrefActive('/send', '/receive', ['/send'])).toBe(true);
    expect(isNavHrefActive('/send/abc', '/receive', ['/send'])).toBe(true);
    expect(isNavHrefActive('/sender', '/receive', ['/send'])).toBe(false);
    expect(isNavHrefActive('/receive', '/receive')).toBe(true);
  });

  it('lights Money, in the sidebar and the tab bar, on every money screen', () => {
    const sidebarMoney = item(ROUTES.RECEIVE);
    const tabMoney = mobileTabBar.find(t => t.href === ROUTES.RECEIVE);
    for (const path of [ROUTES.RECEIVE, ROUTES.SEND, ROUTES.REQUESTS]) {
      expect(isNavHrefActive(path, sidebarMoney?.href, sidebarMoney?.activeFor)).toBe(true);
      expect(isNavHrefActive(path, tabMoney?.href, tabMoney?.activeFor)).toBe(true);
    }
  });

  it('calls the money slot Money on both surfaces', () => {
    expect(item(ROUTES.RECEIVE)?.name).toBe('Money');
    expect(mobileTabBar.find(t => t.href === ROUTES.RECEIVE)?.name).toBe('Money');
  });

  it("lights My things on each type's own list", () => {
    const things = item(ROUTES.DASHBOARD.THINGS);
    expect(isNavHrefActive(ENTITY_REGISTRY.product.basePath, things?.href, things?.activeFor)).toBe(
      true
    );
  });
});

describe('the collapsed rail', () => {
  const sections: NavSection[] = [
    { id: 'main', title: '', priority: 1, items: [{ name: 'Home', href: '/dashboard' }] },
    { id: 'people', title: 'People', priority: 2, items: [{ name: 'People', href: '/people' }] },
    { id: 'more', title: 'More', priority: 3, items: [{ name: 'About', href: '/about' }] },
  ];
  const activeAt = (path: string) => (href: string) => href === path;

  it('keeps main and the section holding the active page', () => {
    const visible = getVisibleSections(sections, false, activeAt('/about')).map(s => s.id);
    expect(visible).toEqual(['main', 'more']);
  });

  it('hides nothing when expanded', () => {
    expect(getVisibleSections(sections, true, activeAt('/x'))).toHaveLength(3);
  });
});

describe('places under "you"', () => {
  it('are in the account menu and not repeated in the sidebar', () => {
    const sidebarHrefs = new Set(allItems.map(i => i.href));
    for (const place of accountNavItems) {
      expect(sidebarHrefs.has(place.href)).toBe(false);
    }
    expect(accountNavItems.map(i => i.href)).toEqual(
      expect.arrayContaining([ROUTES.SETTINGS, ROUTES.FAQ])
    );
  });

  it('are still found from the palette', () => {
    expect(rankItems(buildPages(true), 'settings', 1)[0]?.href).toBe(ROUTES.SETTINGS);
  });

  it('give no two sidebar rows the same icon', () => {
    const icons = allItems.map(i => i.icon).filter(Boolean);
    expect(new Set(icons).size).toBe(icons.length);
  });
});

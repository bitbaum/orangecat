/**
 * Discover is where makers are found. Signed in, it used to sit under "More",
 * next to About: two clicks away, and on /discover nothing in the sidebar lit
 * up because its group was collapsed. A visitor's tab bar called it "Explore"
 * while the page it opened said "Discover".
 */
import {
  PUBLIC_PAGES,
  mobileTabBar,
  mobileTabBarAnonymous,
  sidebarSections,
} from '@/config/navigation';
import { ROUTES } from '@/config/routes';

const main = sidebarSections.find(section => section.id === 'main');

describe('Discover in the signed-in chrome', () => {
  it('is a top-level sidebar item, right after Home', () => {
    const hrefs = main?.items.map(item => item.href) ?? [];
    expect(main?.collapsible).toBe(false);
    expect(hrefs).toContain(ROUTES.DISCOVER);
    expect(hrefs.indexOf(ROUTES.DISCOVER)).toBe(hrefs.indexOf(ROUTES.DASHBOARD.HOME) + 1);
  });

  it('is listed once, not again under a collapsed group', () => {
    const all = sidebarSections.flatMap(section => section.items.map(item => item.href));
    expect(all.filter(href => href === ROUTES.DISCOVER)).toHaveLength(1);
  });

  it('is called by its page name', () => {
    const item = main?.items.find(i => i.href === ROUTES.DISCOVER);
    expect(item?.name).toBe(PUBLIC_PAGES[ROUTES.DISCOVER].name);
  });

  // The phone tab bar is full: five slots, and Create is the only way to
  // create on a phone (the header's + starts at sm). Discover is the phone
  // drawer's top level instead, which is the same `main` section.
  it('leaves the signed-in phone tab bar at five slots', () => {
    expect(mobileTabBar).toHaveLength(5);
  });
});

describe('Discover in the visitor tab bar', () => {
  it('is called Discover, like the page it opens', () => {
    const slot = mobileTabBarAnonymous.find(item => item.href === ROUTES.DISCOVER);
    expect(slot?.name).toBe('Discover');
  });
});

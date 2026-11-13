/**
 * The mobile tab bar is the scarcest real estate in the product, and it used to
 * be a hardcoded array inside MobileBottomNav — which is exactly how it drifted
 * from the sidebar (different Profile destination, and the primary money
 * surface missing entirely). These tests hold the bar to the shared config and
 * to the constraints that make a tab bar usable.
 */

import {
  mobileTabBar,
  mobileTabBarAnonymous,
  sidebarSections,
  type MobileTabItem,
} from '@/config/navigation';
import { ROUTES } from '@/config/routes';

const allBars: Array<[string, MobileTabItem[]]> = [
  ['authenticated', mobileTabBar],
  ['anonymous', mobileTabBarAnonymous],
];

describe.each(allBars)('%s mobile tab bar', (_name, bar) => {
  it('fits the thumb zone — no more than five slots', () => {
    expect(bar.length).toBeGreaterThanOrEqual(4);
    expect(bar.length).toBeLessThanOrEqual(5);
  });

  it('emphasises at most one slot', () => {
    expect(bar.filter(i => i.primary).length).toBeLessThanOrEqual(1);
  });

  // Icons are declared but deliberately not asserted on: several lucide icons
  // resolve to undefined under jest's CJS interop while being real components
  // at runtime, so asserting here would test the transform, not the config.
  it('gives every slot a label and a destination', () => {
    for (const item of bar) {
      expect(item.name.trim()).not.toBe('');
      expect(item.href.startsWith('/')).toBe(true);
      expect(item).toHaveProperty('icon');
    }
  });

  it('never lists the same destination twice', () => {
    const hrefs = bar.map(i => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe('anonymous mobile tab bar', () => {
  // Creating needs an account: a raised Create slot was the loudest control a
  // visitor saw on Discover, and it led straight to the sign-in form.
  it('raises no slot and offers nothing that needs an account', () => {
    expect(mobileTabBarAnonymous.filter(i => i.primary)).toHaveLength(0);
    expect(mobileTabBarAnonymous.filter(i => i.opensCreate)).toHaveLength(0);
    expect(mobileTabBarAnonymous.map(i => i.href)).toEqual([
      ROUTES.HOME,
      ROUTES.DISCOVER,
      ROUTES.HOW_IT_WORKS,
      ROUTES.AUTH,
    ]);
  });
});

describe('authenticated mobile tab bar', () => {
  it('emphasises exactly one slot', () => {
    expect(mobileTabBar.filter(i => i.primary)).toHaveLength(1);
  });

  it('puts getting paid in the emphasised slot', () => {
    expect(mobileTabBar.find(i => i.primary)?.href).toBe(ROUTES.RECEIVE);
  });

  it('agrees with the sidebar on where each destination goes', () => {
    const sidebarHrefs = new Set(
      sidebarSections.flatMap(s => s.items.map(i => i.href)).filter(Boolean)
    );
    // Create opens a sheet rather than being a sidebar destination, so it is
    // the one slot allowed to name a route the sidebar doesn't list.
    for (const item of mobileTabBar.filter(i => !i.opensCreate)) {
      expect(sidebarHrefs.has(item.href)).toBe(true);
    }
  });

  it('routes the create slot through the contextual create surface', () => {
    const create = mobileTabBar.filter(i => i.opensCreate);
    expect(create).toHaveLength(1);
  });
});

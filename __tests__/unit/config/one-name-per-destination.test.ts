/**
 * A signed-in destination has one name across the chrome.
 *
 * ROUTES.RECEIVE was "Money" in the sidebar and "Receive" in the tab bar.
 * (The avatar menu's places are pinned in app-shell-nav.test.ts.)
 */
import { mobileTabBar, sidebarSections } from '@/config/navigation';
import { ROUTES } from '@/config/routes';

const sidebarItems = sidebarSections.flatMap(section => section.items);
const sidebarName = (href: string) => sidebarItems.find(item => item.href === href)?.name;

describe('one name per destination', () => {
  it('the tab bar calls each sidebar destination by the sidebar name', () => {
    for (const slot of mobileTabBar.filter(item => !item.opensCreate)) {
      expect(slot.name, slot.href).toBe(sidebarName(slot.href));
    }
    expect(mobileTabBar.find(item => item.href === ROUTES.RECEIVE)?.name).toBe('Money');
  });
});

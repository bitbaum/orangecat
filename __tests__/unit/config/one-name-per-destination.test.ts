/**
 * A signed-in destination has one name across the chrome.
 *
 * ROUTES.RECEIVE was "Money" in the sidebar and "Receive" in the tab bar; the
 * avatar menu hard-coded "Dashboard", "My projects" and "Your page" for places
 * the sidebar calls Home, My things and Profile.
 */
import { getAccountMenuPlaces, mobileTabBar, sidebarSections } from '@/config/navigation';
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

  it('the avatar menu is Home, My things, Profile, Settings, named as in the sidebar', () => {
    const places = getAccountMenuPlaces();
    expect(places.map(place => place.href)).toEqual([
      ROUTES.DASHBOARD.HOME,
      ROUTES.DASHBOARD.THINGS,
      ROUTES.PROFILES.ME,
      ROUTES.SETTINGS,
    ]);
    for (const place of places) {
      expect(place.name).toBe(sidebarName(place.href));
    }
  });
});

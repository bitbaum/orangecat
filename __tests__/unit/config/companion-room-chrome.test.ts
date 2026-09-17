import { describe, it, expect } from 'vitest';
import { getRouteChrome, getRouteSurface, isCompanionTalkPath } from '@/config/routes';

/**
 * In a companion's room the conversation is the page: no floating Cat, no
 * mobile bottom nav, sidebar collapsed — the same focus the Cat hub gets.
 * Everywhere else on /companions the normal app chrome stays.
 */
describe('companion room chrome', () => {
  it('recognises the room and nothing else', () => {
    expect(isCompanionTalkPath('/companions/abc/talk')).toBe(true);
    expect(isCompanionTalkPath('/companions/abc/talk/')).toBe(true);
    expect(isCompanionTalkPath('/companions/abc')).toBe(false);
    expect(isCompanionTalkPath('/companions/abc/memory')).toBe(false);
    expect(isCompanionTalkPath('/companions')).toBe(false);
    expect(isCompanionTalkPath('/dashboard/companions/abc')).toBe(false);
  });

  it('strips the chrome in the room, keeps it on the profile', () => {
    expect(getRouteChrome('/companions/abc/talk')).toEqual({
      hideMobileBottomNav: true,
      preferCollapsedSidebar: true,
      hideGlobalCat: true,
    });
    expect(getRouteChrome('/companions/abc')).toEqual({
      hideMobileBottomNav: false,
      preferCollapsedSidebar: false,
      hideGlobalCat: false,
    });
  });

  it('keeps the Cat hub exactly as it was', () => {
    expect(getRouteChrome('/dashboard/cat')).toEqual({
      hideMobileBottomNav: true,
      preferCollapsedSidebar: true,
      hideGlobalCat: true,
    });
  });

  it('is an app surface, so the room renders inside the shell', () => {
    expect(getRouteSurface('/companions/abc/talk')).toBe('app');
  });
});

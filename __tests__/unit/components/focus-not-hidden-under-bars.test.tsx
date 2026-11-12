// @vitest-environment jsdom
/**
 * Keyboard focus was hidden under the fixed bars on a phone (WCAG 2.4.11).
 * Production, 390px, light and dark, 2026-11-12, tabbing and sampling a 5x5
 * grid of elementFromPoint over each focus stop:
 *
 *   - Tab: /timeline's Reply, Repost, Like, Dislike and Share took focus at
 *     y=609, wholly under the tab bar (583-664); 11 of 60 stops there, 18 of
 *     56 on /dashboard/things. The browser scrolls focus only to the
 *     viewport's edge, and nothing told it the bar covers that edge.
 *   - Shift+Tab: the same controls landed at y=0, under the header that
 *     scrolling up brings back.
 *   - Past the last stop, Tab wraps to the header's own controls (Open
 *     search, Notifications, User menu, Get Started) while the header was
 *     still slid away for the scroll-down: focused at y=-51, nothing visible.
 *
 * With the rules below injected into production, every stop on /timeline,
 * /dashboard, /dashboard/things, /pay/cato and a project page had part of
 * itself on screen, both directions. jsdom has no layout, so this pins the
 * rules and the elements they name.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss, { type AtRule } from 'postcss';
import { render } from '@testing-library/react';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { HEADER_DIMENSIONS } from '@/constants/header';
import { getHeaderClasses } from '@/lib/ui/header-utils';

vi.mock('next/navigation', () => ({
  usePathname: () => '/timeline',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, hydrated: true }) }));
vi.mock('@/hooks/useHeaderScroll', () => ({ useBottomNavScroll: () => ({ isCompact: false }) }));
vi.mock('@/hooks/useSoftKeyboard', () => ({ useSoftKeyboard: () => false }));
vi.mock('@/contexts/ComposerContext', () => ({ useComposer: () => ({ openComposer: vi.fn() }) }));
vi.mock('@/components/create/VoiceCreate', () => ({ VoiceCreate: () => null }));

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const css = postcss.parse(read('src/app/globals.css'));

/** Every declaration under `selector`, with the @media it sits in, if any. */
function declarationsFor(selector: string) {
  const found: Array<{ media: string | null; prop: string; value: string }> = [];
  css.walkRules(rule => {
    if (!rule.selectors.includes(selector)) {
      return;
    }
    const parent = rule.parent as AtRule | undefined;
    const media = parent?.type === 'atrule' && parent.name === 'media' ? parent.params : null;
    rule.walkDecls(d => {
      // Whitespace is the formatter's, not the rule's.
      const value = d.value.replace(/\s+/g, ' ').replace(/\(\s/g, '(').replace(/\s\)/g, ')').trim();
      found.push({ media, prop: d.prop, value });
    });
  });
  return found;
}

const classesOf = (value: string) => value.split(/\s+/);

describe('keyboard focus is never hidden under the fixed bars', () => {
  it('on a phone, focus scrolls clear of the tab bar while the bar is on the page', () => {
    expect(declarationsFor('html:has(.app-mobile-nav)')).toEqual([
      {
        media: '(max-width: 767px)',
        prop: 'scroll-padding-bottom',
        value: 'var(--mobile-nav-clearance)',
      },
    ]);
  });

  it('the element that rule names is the tab bar', () => {
    const { container } = render(<MobileBottomNav />);
    const bar = container.querySelector('.app-mobile-nav');
    expect(bar).not.toBeNull();
    expect(bar?.querySelector('nav[aria-label="Mobile navigation"]')).not.toBeNull();
  });

  it('keyboard focus scrolls clear of the header: its row, its status-bar inset and its banner', () => {
    const rem = (px: number) => `${px / 16}rem`;
    expect(declarationsFor('html:has(.app-header):has(:focus-visible)')).toEqual([
      {
        media: null,
        prop: 'scroll-padding-top',
        value: `calc(${rem(HEADER_DIMENSIONS.HEIGHT_MOBILE_PX)} + env(safe-area-inset-top, 0px) + var(--header-banner-height, 0px))`,
      },
      {
        media: '(min-width: 640px)',
        prop: 'scroll-padding-top',
        value: `calc(${rem(HEADER_DIMENSIONS.HEIGHT_DESKTOP_PX)} + env(safe-area-inset-top, 0px) + var(--header-banner-height, 0px))`,
      },
    ]);
    expect(read('src/components/layout/Header.tsx')).toMatch(/className=\{`app-header /);
  });

  it('the header slid away on scroll-down comes back while keyboard focus is inside it', () => {
    const hidden = classesOf(getHeaderClasses(true, true));
    expect(hidden).toContain('-translate-y-full');
    expect(hidden).toContain('has-focus-visible:translate-y-0');

    const shown = classesOf(getHeaderClasses(true, false));
    expect(shown).toContain('translate-y-0');
    expect(shown).not.toContain('-translate-y-full');
  });
});

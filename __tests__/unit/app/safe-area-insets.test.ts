import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss, { type ChildNode, type Container, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

/**
 * iPhone home-screen app (viewportFit: 'cover'): each safe-area inset is
 * applied once, by the surface at that edge. html used to pad all four as
 * well, on top of the header, the tab bar and the chat's own toolbar and
 * composer. Measured live 2026-11-12 at 390x844 with insets 47/34: every app
 * page scrolled 81px it did not have, /messages and the Cat ran 47px past the
 * bottom of the screen, and the phone drawer ran under the tab bar (its
 * "Close menu" could not be tapped, with or without insets).
 *
 * This reads globals.css the way the browser would at a given screen and
 * adds the edges up, so the numbers here are the layout's numbers.
 */
const css = postcss.parse(readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8'));

interface Screen {
  width: number;
  height: number;
  top: number;
  bottom: number;
}
/** An iPhone 13 home-screen app: the whole screen, the insets inside it. */
const HOME_SCREEN_APP: Screen = { width: 390, height: 844, top: 47, bottom: 34 };
/** The same phone in a Safari tab: no insets reach the page. */
const SAFARI_TAB: Screen = { width: 390, height: 664, top: 0, bottom: 0 };
const IPAD_APP: Screen = { width: 820, height: 1180, top: 24, bottom: 20 };

const REM = 16;
/** Header.tsx: paddingTop env(safe-area-inset-top) over an h-14 / sm:h-16 row. */
const headerBottom = (s: Screen) => (s.width >= 640 ? 4 : 3.5) * REM + s.top;
/** MobileBottomNav: --mobile-nav-height tall, padded by the bottom inset. */
const tabBarTop = (s: Screen) => s.height - px('var(--mobile-nav-clearance)', s);

function mediaMatches(params: string, width: number): boolean {
  return params.split(/\band\b/).every(part => {
    const min = /^\s*\(min-width:\s*(\d+)px\)\s*$/.exec(part);
    if (min) return width >= Number(min[1]);
    const max = /^\s*\(max-width:\s*(\d+)px\)\s*$/.exec(part);
    if (max) return width <= Number(max[1]);
    return false; // print, prefers-reduced-motion, hover…: not this screen
  });
}

function applies(node: ChildNode, width: number): boolean {
  for (let p: Container | undefined = node.parent; p && p.type !== 'root'; p = p.parent) {
    if (p.type === 'atrule' && 'name' in p && p.name === 'media') {
      if (!mediaMatches(String(p.params), width)) return false;
    }
  }
  return true;
}

/** Splits a value on top-level whitespace: `env(a) env(b)` → two tokens. */
function tokens(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of value.trim()) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

/** The declared value of `prop` on exactly `selector` at this width (last one wins). */
function declared(selector: string, prop: string, width: number): string | undefined {
  const shorthand = /^padding-(top|right|bottom|left)$/.exec(prop);
  let value: string | undefined;
  css.walkRules((rule: Rule) => {
    if (!rule.selectors.map(s => s.replace(/\s+/g, ' ')).includes(selector)) return;
    if (!applies(rule, width)) return;
    rule.walkDecls(decl => {
      if (decl.parent !== rule) return;
      if (decl.prop === prop) value = decl.value;
      if (shorthand && decl.prop === 'padding') {
        const [t, r = t, b = t, l = r] = tokens(decl.value);
        value = { top: t, right: r, bottom: b, left: l }[shorthand[1] as (typeof SIDES)[number]];
      }
    });
  });
  return value;
}

/** Resolves var(), env(), rem and calc() to pixels on this screen. */
function px(value: string, s: Screen): number {
  let v = value;
  for (let i = 0; i < 20 && /\b(var|env)\(/.test(v); i++) {
    v = v.replace(/env\(\s*safe-area-inset-(top|right|bottom|left)\s*(?:,[^()]*)?\)/g, (_, side) =>
      side === 'top' ? `${s.top}px` : side === 'bottom' ? `${s.bottom}px` : '0px'
    );
    v = v.replace(
      /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g,
      (_, name, fb) => {
        if (name === '--app-viewport-height') return `${s.height}px`; // ViewportHeightSync
        const own = declared(':root', name, s.width);
        if (own !== undefined) return `(${own})`;
        if (fb !== undefined) return `(${fb})`;
        throw new Error(`${name} is not defined in globals.css`);
      }
    );
  }
  const expr = v
    .replace(/calc\(/g, '(')
    .replace(/(\d*\.?\d+)rem/g, (_, n) => String(Number(n) * REM))
    .replace(/(\d*\.?\d+)px/g, '$1')
    .replace(/100dvh/g, String(s.height));
  if (!/^[\d\s.+\-*/()]+$/.test(expr)) throw new Error(`cannot evaluate "${value}" → "${expr}"`);
  return Number(new Function(`return (${expr});`)());
}

const edge = (selector: string, prop: string, s: Screen) => {
  const value = declared(selector, prop, s.width);
  return value === undefined ? 0 : px(value, s);
};

describe('safe-area insets, applied once', () => {
  it('html takes no top or bottom inset: the surfaces at those edges do', () => {
    for (const s of [HOME_SCREEN_APP, IPAD_APP]) {
      expect(edge('html', 'padding-top', s)).toBe(0);
      expect(edge('html', 'padding-bottom', s)).toBe(0);
    }
  });

  it('page content starts where the header (inset included) ends', () => {
    for (const s of [HOME_SCREEN_APP, SAFARI_TAB, IPAD_APP]) {
      const contentTop =
        edge('html', 'padding-top', s) + edge('.app-header-offset', 'padding-top', s);
      expect(contentTop).toBe(headerBottom(s));
    }
  });

  it('a full-height frame (messages, the Cat on a tablet) ends at the bottom of the screen', () => {
    for (const s of [HOME_SCREEN_APP, SAFARI_TAB, IPAD_APP]) {
      const top = edge('html', 'padding-top', s) + edge('.app-header-offset', 'padding-top', s);
      const bottom = top + edge('.app-content-height', 'height', s);
      expect(bottom).toBe(s.height);
      // …and nothing is added below it, so the page does not scroll.
      expect(
        edge('html', 'padding-bottom', s) +
          edge('.app-page-foot:has(.app-content-height)', 'padding-bottom', s)
      ).toBe(0);
    }
  });

  it('the Cat on a phone is the whole screen: no header, its toolbar and composer pad their own insets', () => {
    const s = HOME_SCREEN_APP;
    const top =
      edge('html', 'padding-top', s) +
      edge('.app-immersive-chat.app-header-offset', 'padding-top', s);
    expect(top).toBe(0);
    expect(top + edge('.app-immersive-chat .app-content-height', 'height', s)).toBe(s.height);
  });

  it('under a tab-bar page the home indicator is cleared once, by the clearance', () => {
    const s = HOME_SCREEN_APP;
    const below =
      edge('html', 'padding-bottom', s) + edge('.app-bottom-nav-clearance', 'padding-bottom', s);
    expect(below).toBe(6.5 * REM + s.bottom);
    // From md there is no bar, and an iPad's home indicator is still there.
    expect(edge('.app-bottom-nav-clearance', 'padding-bottom', IPAD_APP)).toBe(IPAD_APP.bottom);
    expect(edge('.app-chat-nav-clearance', 'padding-bottom', IPAD_APP)).toBe(IPAD_APP.bottom);
  });

  it('a page with no tab bar (public, the footer, sign-in) still clears the home indicator', () => {
    for (const s of [HOME_SCREEN_APP, IPAD_APP]) {
      const below = edge('html', 'padding-bottom', s) + edge('.app-page-foot', 'padding-bottom', s);
      expect(below).toBe(s.bottom);
    }
  });
});

describe('the phone drawer sits between the header and the tab bar', () => {
  it('starts at the header’s bottom, no strip of page between them', () => {
    for (const s of [HOME_SCREEN_APP, SAFARI_TAB, IPAD_APP]) {
      expect(edge('.app-sidebar', 'top', s)).toBe(headerBottom(s));
    }
  });

  it('ends on top of the tab bar, so "Close menu" is above it, not under it', () => {
    for (const s of [HOME_SCREEN_APP, SAFARI_TAB]) {
      const drawerBottom = s.height - edge('.app-sidebar[data-above-mobile-nav]', 'bottom', s);
      expect(drawerBottom).toBe(tabBarTop(s));
      // The bar already clears the home indicator; the drawer does not again.
      expect(edge('.app-sidebar[data-above-mobile-nav]', 'padding-bottom', s)).toBe(0);
    }
  });

  it('runs to the bottom edge where there is no bar, clear of the home indicator', () => {
    const s = IPAD_APP; // a drawer from md to lg, a rail from lg: no tab bar either way
    expect(edge('.app-sidebar[data-above-mobile-nav]', 'bottom', s)).toBe(0);
    expect(edge('.app-sidebar', 'bottom', s)).toBe(0);
    expect(edge('.app-sidebar', 'padding-bottom', s)).toBe(s.bottom);
  });
});

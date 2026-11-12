// @vitest-environment jsdom
/**
 * Measured on orangecat.ch (2026-11-12, iPhone 13 at 390px, light and dark):
 *
 *  - The counts on the Discover chips ("Projects 14") were the chip's ink at
 *    opacity 60%: #a3a3a3 on white, 2.52:1, and #6f6f6f on #1c1c1c, 3.39:1
 *    (4.28:1 on the active chip in dark). 12px text needs 4.5:1.
 *  - The unread badge on the header bell was white on dark mode's light red,
 *    #ffffff on #e64d4d: 3.80:1 at 10px.
 *  - Tabbing through Discover, the focus ring (2px, 2px out) lost its top and
 *    bottom on every chip, and its top on every rail card: both rows scroll
 *    sideways, and overflow-x: auto clips overflow-y too. From 640px the chips
 *    wrap but still clipped, so the first chip lost its left edge as well.
 *
 * These read the same CSS the site is built from (src/app/globals.css) and
 * the badge component, so a change that brings any of them back fails here.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { NotificationBadge } from '@/components/ui/NotificationBadge';

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('.dark {'));
const darkBlock = css.slice(css.indexOf('.dark {'));
const themes = { light: rootBlock, dark: darkBlock } as const;

/** A token's `H S% L%` triple from one theme block, as sRGB 0-255. */
function token(block: string, name: string): [number, number, number] {
  const m = block.match(new RegExp(`${name}:\\s*(\\d+) (\\d+)% (\\d+)%;`));
  expect(m, `${name} is an HSL triple`).toBeTruthy();
  const [h, s, l] = [Number(m![1]), Number(m![2]) / 100, Number(m![3]) / 100];
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return [f(0), f(8), f(4)];
}

function ratio(a: number[], b: number[]): number {
  const lum = (c: number[]) =>
    c
      .map(v => v / 255)
      .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The utilities a component class applies, split by breakpoint. */
function applied(selector: string): { base: string[]; sm: string[] } {
  const at = css.indexOf(`${selector} {`);
  expect(at, `${selector} is in globals.css`).toBeGreaterThan(-1);
  const line = css.slice(at).match(/@apply ([^;]+);/);
  const all = line![1].split(/\s+/);
  return {
    base: all.filter(c => !c.includes(':')),
    sm: all.filter(c => c.startsWith('sm:')).map(c => c.slice(3)),
  };
}

/** Tailwind spacing in px (1 = 4px) for one side, from p-/py-/pt-/pb- etc. */
function padding(classes: string[], side: 't' | 'b' | 'l' | 'r'): number | null {
  const axis = side === 't' || side === 'b' ? 'y' : 'x';
  let px: number | null = null;
  for (const c of classes) {
    const m = c.match(/^p([trblxy]?)-(\d+(?:\.\d+)?)$/);
    if (m && (m[1] === '' || m[1] === axis || m[1] === side)) px = Number(m[2]) * 4;
  }
  return px;
}

/** Margin in px for one vertical side, negatives included (-mt-1 → -4). */
function margin(classes: string[], side: 't' | 'b'): number {
  let px = 0;
  for (const c of classes) {
    const m = c.match(/^(-?)m([tby]?)-(\d+(?:\.\d+)?)$/);
    if (m && (m[2] === '' || m[2] === 'y' || m[2] === side)) {
      px = (m[1] ? -1 : 1) * Number(m[3]) * 4;
    }
  }
  return px;
}

const scrolls = (classes: string[]) =>
  classes.some(c => /^overflow(-[xy])?-(auto|scroll|hidden)$/.test(c));

/** The global keyboard focus ring: ring width plus its offset, in px. */
function ringReach(): number {
  const rule = css.match(/\*:focus-visible \{\s*@apply ([^;]+);/);
  expect(rule, 'the global focus-visible rule').toBeTruthy();
  const width = rule![1].match(/(?:^|\s)ring-(\d+)(?:\s|$)/);
  const offset = rule![1].match(/(?:^|\s)ring-offset-(\d+)(?:\s|$)/);
  return Number(width?.[1] ?? 0) + Number(offset?.[1] ?? 0);
}

describe('Discover chip counts read at AA', () => {
  // The count has no colour of its own: it is the chip's ink, at whatever
  // opacity the class gives it, over the chip's background.
  const { base } = applied('.oc-discover-chip-count');
  const opacity = Number(base.find(c => /^opacity-\d+$/.test(c))?.slice(8) ?? 100) / 100;

  const chips = {
    resting: { ink: '--text-secondary', on: '--surface-base' },
    active: { ink: '--text-inverted', on: '--text-primary' },
  };
  for (const [state, { ink, on }] of Object.entries(chips)) {
    for (const [theme, block] of Object.entries(themes)) {
      it(`${state} chip, ${theme}`, () => {
        const fg = token(block, ink);
        const bg = token(block, on);
        const seen = fg.map((v, i) => Math.round(v * opacity + bg[i] * (1 - opacity)));
        expect(ratio(seen, bg)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('the unread badge reads at AA', () => {
  // The ink class the badge renders, to the colour it paints.
  const inks: Record<string, (block: string) => number[]> = {
    'text-white': () => [255, 255, 255],
    'text-fg-inverted': block => token(block, '--text-inverted'),
    'text-destructive-foreground': block => token(block, '--text-inverted'),
  };

  function badge() {
    const { container } = render(<NotificationBadge count={3} />);
    return container.firstElementChild as HTMLElement;
  }

  for (const [theme, block] of Object.entries(themes)) {
    it(`on bg-status-negative, ${theme}`, () => {
      const classes = badge().className.split(/\s+/);
      expect(classes).toContain('bg-status-negative');
      const ink = classes.find(c => c in inks);
      expect(ink, 'the badge names one ink class this test knows').toBeTruthy();
      expect(ratio(inks[ink!](block), token(block, '--status-negative'))).toBeGreaterThanOrEqual(
        4.5
      );
    });
  }

  it('leaves the count to the label of the control it sits on', () => {
    // An aria-label is not allowed on a plain span; the bell's own label
    // already reads "Notifications (3 unread)".
    expect(badge().hasAttribute('aria-label')).toBe(false);
    expect(badge().textContent).toBe('3');
  });
});

describe('focus rings on Discover are not cut by the rows that scroll', () => {
  const reach = ringReach();

  it('the ring reaches past the element at all (the premise of this test)', () => {
    expect(reach).toBeGreaterThan(0);
  });

  it('the chips keep room for it above and below while they scroll, and do not shift', () => {
    const { base, sm } = applied('.oc-discover-chips');
    expect(scrolls(base)).toBe(true);
    expect(padding(base, 't')).toBeGreaterThanOrEqual(reach);
    expect(padding(base, 'b')).toBeGreaterThanOrEqual(reach);
    // The padding is given back in margin: the chips sit 20px under the
    // search field, and the header's margin below them is unchanged.
    expect(margin(base, 't') + padding(base, 't')!).toBe(20);
    expect(margin(base, 'b') + padding(base, 'b')!).toBe(0);
    // From sm they wrap, flush with the page edge: nothing may clip there.
    expect(sm).toContain('flex-wrap');
    expect(sm).toContain('overflow-visible');
  });

  it('each rail keeps room for it above its cards while it scrolls, and does not shift', () => {
    const { base, sm } = applied('.oc-discover-rail-track');
    expect(scrolls(base)).toBe(true);
    expect(padding(base, 't')).toBeGreaterThanOrEqual(reach);
    expect(padding(base, 'b')).toBeGreaterThanOrEqual(reach);
    expect(margin(base, 't') + padding(base, 't')!).toBe(0);
    expect(sm).toContain('overflow-visible');
  });
});

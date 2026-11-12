/**
 * Tertiary text (dates, counts, hints, captions) measured 2.8:1 on the light
 * page and 3.6:1 on the dark raised surface on orangecat.ch (2026-11-12),
 * below WCAG AA's 4.5:1. The values match @bitbaum/design-tokens#62; this pins
 * the app's own copy of them in src/app/globals.css. Muted is left out: it is
 * for disabled and decorative text.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('.dark {'));
const darkBlock = css.slice(css.indexOf('.dark {'));

function value(block: string, name: string): number {
  const m = block.match(new RegExp(`${name}:\\s*0 0% (\\d+)%;`));
  expect(m, `${name} is a grey HSL triple`).toBeTruthy();
  return Number(m![1]);
}

function luminance(lightnessPercent: number): number {
  const s = Math.round((lightnessPercent / 100) * 255) / 255;
  const c = s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  return c; // grey: r = g = b
}

function ratio(a: number, b: number): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('the text ramp people read clears AA', () => {
  for (const text of ['--text-secondary', '--text-tertiary']) {
    for (const surface of ['--surface-page', '--surface-base', '--surface-raised']) {
      it(`${text} on ${surface}, light and dark`, () => {
        expect(ratio(value(rootBlock, text), value(rootBlock, surface))).toBeGreaterThanOrEqual(
          4.5
        );
        expect(ratio(value(darkBlock, text), value(darkBlock, surface))).toBeGreaterThanOrEqual(
          4.5
        );
      });
    }
  }
});

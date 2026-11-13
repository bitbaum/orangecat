/**
 * Three rules in globals.css that no component can see and no type-check
 * reads, each measured broken on 2026-11-12:
 *   - forced colours (Windows High Contrast) remove box-shadows, and the focus
 *     ring is one: 67 of 67 tab stops showed no focus indicator;
 *   - `scroll-smooth` on <html> animated every anchor jump for people who
 *     asked for reduced motion;
 *   - `hyphens: auto` on headings cut ordinary words ("permission-less").
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

/** The body of the first `<opener> {` block, braces balanced. */
function blockAfter(opener: string): string {
  const start = css.indexOf(opener);
  expect(start, `${opener} is in globals.css`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') {
      depth += 1;
    } else if (css[i] === '}' && --depth === 0) {
      return css.slice(start, i + 1);
    }
  }
  throw new Error(`${opener}: unbalanced braces`);
}

describe('globals.css accessibility rules', () => {
  it('draws a real outline on focus when colours are forced', () => {
    const forced = blockAfter('@media (forced-colors: active)');
    expect(forced).toContain('*:focus-visible');
    expect(forced).toMatch(/outline:\s*2px solid Highlight\s*!important/);
  });

  it('scrolls smoothly only when motion is allowed', () => {
    expect(css).not.toMatch(/@apply[^;]*\bscroll-smooth\b/);
    const allowed = blockAfter('@media (prefers-reduced-motion: no-preference)');
    expect(allowed).toMatch(/html\s*\{\s*scroll-behavior:\s*smooth/);
    const htmlRule = blockAfter('\n  html {');
    expect(htmlRule).not.toContain('scroll-behavior');
  });

  it('does not hyphenate headings automatically', () => {
    const headings = blockAfter('h1,\n  h2,\n  h3,\n  h4,\n  h5,\n  h6 {');
    expect(headings).toMatch(/^\s*hyphens: manual;/m);
    expect(headings).not.toMatch(/^\s*hyphens: auto;/m);
  });
});

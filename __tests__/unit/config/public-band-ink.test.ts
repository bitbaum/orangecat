/**
 * The closing call-to-action bands on /about, /docs, /security and /domains
 * sit on `bg-surface-public`, which is near-black (4%) in BOTH themes on
 * purpose. Their text used `text-fg-inverted`, which flips with the theme:
 * 98% in light, 10% in dark. Measured on production at 390px in dark — the
 * site's default theme — that was 10% text on a 4% band, 1.14:1: the heading,
 * the sentence under it and the outline button were not there to read. Only
 * the orange button survived, because it carries its own ink.
 *
 * A band that never flips takes an ink that never flips: `--on-public`,
 * declared identically in both theme blocks, the way `--on-accent` is for
 * the orange.
 */

import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8');

/** The body of the first `selector {` block, braces balanced. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') {
      depth++;
    } else if (css[i] === '}' && --depth === 0) {
      return css.slice(start, i);
    }
  }
  throw new Error(`unclosed ${selector} block`);
}

function token(body: string, name: string): string {
  const match = body.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) {
    throw new Error(`--${name} is not declared in this theme block`);
  }
  return match[1].trim();
}

/** `H S% L%` channels, as every semantic token here is written, to sRGB. */
function hslToRgb(channels: string): [number, number, number] {
  const match = channels.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!match) {
    throw new Error(`not bare HSL channels: ${channels}`);
  }
  const [h, s, l] = [Number(match[1]), Number(match[2]) / 100, Number(match[3]) / 100];
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function contrast(fg: string, bg: string): number {
  const luminance = (rgb: [number, number, number]) => {
    const [r, g, b] = rgb.map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(hslToRgb(fg)), luminance(hslToRgb(bg))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('the always-dark public band', () => {
  const themes = { light: block(':root'), dark: block('.dark') };

  it.each(Object.entries(themes))('stays dark in the %s theme', (_theme, body) => {
    expect(token(body, 'surface-public')).toBe('0 0% 4%');
  });

  it.each(Object.entries(themes))(
    'has an ink that reads on it in the %s theme (AAA, 7:1)',
    (_theme, body) => {
      expect(contrast(token(body, 'on-public'), token(body, 'surface-public'))).toBeGreaterThan(7);
    }
  );

  it('declares that ink identically in both themes, since the band does not flip', () => {
    expect(token(themes.dark, 'on-public')).toBe(token(themes.light, 'on-public'));
  });

  it('maps the ink to the text-on-public utility', () => {
    const tailwind = readFileSync(join(ROOT, 'tailwind.config.ts'), 'utf8');
    expect(tailwind).toMatch(/'on-public':\s*'hsl\(var\(--on-public\)\)'/);
  });

  it('every band uses that ink, not the theme-flipping fg-inverted', () => {
    const bands = sourceFiles(join(ROOT, 'src')).filter(file =>
      readFileSync(file, 'utf8').includes('bg-surface-public')
    );
    // The four pages measured on production; more may join, none may leave unnoticed.
    expect(bands.length).toBeGreaterThanOrEqual(4);

    const offenders = bands.flatMap(file => {
      const source = readFileSync(file, 'utf8');
      const name = relative(ROOT, file);
      const problems: string[] = [];
      if (/\bfg-inverted\b/.test(source)) {
        problems.push(`${name}: fg-inverted flips to near-black in dark — use on-public`);
      }
      if (!/\btext-on-public\b/.test(source)) {
        problems.push(`${name}: no text-on-public on the band`);
      }
      return problems;
    });

    expect(offenders).toEqual([]);
  });
});

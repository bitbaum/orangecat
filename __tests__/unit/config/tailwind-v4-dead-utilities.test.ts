/**
 * Tailwind v4 deleted the `*-opacity-*` utilities. They don't warn — they
 * simply don't exist, so `bg-black bg-opacity-20` keeps the `bg-black` and
 * drops the 20%: a solid black rectangle where a subtle scrim was intended.
 *
 * That is what turned the profile banner black on every maker profile, and
 * what made the avatar's hover scrim in the profile editor an opaque black
 * square instead of a 30% dim. Both had been that way since the v4 upgrade,
 * and neither the type checker nor the linter can see inside a class string.
 *
 * The v4 spelling is the slash modifier: `bg-black/20`, `ring-black/5`.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(process.cwd(), 'src');

/** `bg-opacity-20`, `hover:ring-opacity-5`, `dark:text-opacity-100`, … */
const DEAD_UTILITY =
  /(?:^|[\s"'`:])((?:[a-z-]+:)*(?:bg|text|border|ring|divide|placeholder|from|via|to)-opacity-\d+)/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
  });
}

describe('Tailwind v4', () => {
  it('is actually looking at the source tree it claims to scan', () => {
    expect(statSync(SRC).isDirectory()).toBe(true);
    expect(sourceFiles(SRC).length).toBeGreaterThan(100);
  });

  it('has no *-opacity-* utilities left — v4 dropped them silently', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const source = readFileSync(file, 'utf8');
      source.split('\n').forEach((line, index) => {
        for (const [, utility] of line.matchAll(DEAD_UTILITY)) {
          offenders.push(`${file.replace(process.cwd() + '/', '')}:${index + 1} ${utility}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});

/**
 * One orange: the warm accent is for the step that brings someone in, and for
 * Bitcoin. Inside the app — the signed-in pages and onboarding — an action is
 * `primary` (auth-firstrun #7). It crept back in on six actions, one of them
 * a disabled orange button, so this holds the line where it was drawn.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SCANNED = ['src/app/(authenticated)', 'src/components/onboarding'];

// Not an action: the usage meter's fill on settings/usage. Listed by name so
// a new file is checked from its first line.
const ALLOWED = new Set(['src/app/(authenticated)/settings/usage/page.tsx']);

// The accent variant, or the solid accent fill (a /15 tint is not a button).
const ACCENT = /variant=["']accent["']|(?<![\w:-])bg-accent-warm(?![\w/-])/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('no warm accent inside the app', () => {
  it('signed-in pages and onboarding use primary for their actions', () => {
    const offenders = SCANNED.flatMap(dir => files(join(ROOT, dir)))
      .map(path => relative(ROOT, path))
      .filter(path => !ALLOWED.has(path))
      .flatMap(path =>
        readFileSync(join(ROOT, path), 'utf8')
          .split('\n')
          .flatMap((line, i) => (ACCENT.test(line) ? [`${path}:${i + 1}`] : []))
      );
    expect(offenders).toEqual([]);
  });
});

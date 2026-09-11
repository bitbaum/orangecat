import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * The nightly Cat eval runs from /opt/orangecat/scripts on the box, copied
 * there by scripts/deploy-selfhost.sh. eval-cat.mjs imports siblings by
 * relative path, so every sibling must be copied too — the deploy script's
 * own comment warned "ship them together or the timer breaks", and on
 * 2026-09-11 a fourth sibling was added without the list being updated: the
 * deployed eval-cat.mjs pointed at a file that did not exist on the box.
 *
 * The deploy now ships `scripts/eval-*.mjs` as one glob. This test pins two
 * things so the class stays closed: the glob is still there, and every
 * relative import of every eval script is a file that glob covers.
 */

const ROOT = join(__dirname, '../../..');
const SCRIPTS = join(ROOT, 'scripts');

const evalScripts = readdirSync(SCRIPTS).filter(f => /^eval-.*\.mjs$/.test(f));

function relativeImports(file: string): string[] {
  const src = readFileSync(join(SCRIPTS, file), 'utf8');
  return [...src.matchAll(/from\s+'\.\/([^']+)'/g)].map(m => m[1]);
}

describe('eval scripts reach the box together', () => {
  const deploy = readFileSync(join(ROOT, 'scripts/deploy-selfhost.sh'), 'utf8')
    .replace(/^[ \t]*#.*$/gm, ''); // comments must not satisfy this

  it('deploys every eval-*.mjs by glob, not by a hand-written list', () => {
    expect(deploy).toContain('scripts/eval-*.mjs');
  });

  it('has at least the scripts this test is about', () => {
    expect(evalScripts).toContain('eval-cat.mjs');
    expect(evalScripts).toContain('eval-auth.mjs');
  });

  it.each(evalScripts)('%s imports only siblings the glob ships', file => {
    for (const imported of relativeImports(file)) {
      // Must be a sibling in scripts/ AND named so the glob picks it up.
      expect(evalScripts, `${file} imports ./${imported}`).toContain(imported);
      expect(imported, `${file} imports ./${imported}, which scripts/eval-*.mjs does not cover`).toMatch(
        /^eval-.*\.mjs$/
      );
    }
  });
});

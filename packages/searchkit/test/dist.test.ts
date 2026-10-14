/**
 * The fleet installs searchkit from git and runs `dist/` as committed, so a
 * change to `src/` that was not rebuilt would ship the OLD search to every
 * other site while OrangeCat's own tests passed. Rebuild into a scratch
 * directory and require it to match, file for file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';

const pkg = join(import.meta.dirname, '..');
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]
  );
}

test('dist/ is the build of src/ (run `pnpm run build`)', { timeout: 60_000 }, () => {
  const out = mkdtempSync(join(tmpdir(), 'searchkit-dist-'));
  try {
    execFileSync(process.execPath, [tsc, '-p', join(pkg, 'tsconfig.json'), '--outDir', out]);
    const built = files(out)
      .map(f => relative(out, f))
      .sort();
    const committed = files(join(pkg, 'dist'))
      .map(f => relative(join(pkg, 'dist'), f))
      .sort();
    assert.deepEqual(committed, built);
    for (const file of built) {
      assert.equal(
        readFileSync(join(pkg, 'dist', file), 'utf8'),
        readFileSync(join(out, file), 'utf8'),
        `dist/${file} is stale`
      );
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

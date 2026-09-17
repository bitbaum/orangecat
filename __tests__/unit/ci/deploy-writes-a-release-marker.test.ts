/**
 * The deploy must record WHICH COMMIT it shipped.
 *
 * Without it, "what is live?" is an inference. On 2026-09-15 every CD run for a
 * merge reported `cancelled` while the box had in fact swapped in a new release
 * — CI status and box state disagreed in BOTH directions — and the only way to
 * answer the question was grepping the built bundle for a string the change
 * happened to introduce.
 *
 * That works by luck, and it ran out twice in one session:
 *   - a refactor that adds no new string literal is unverifiable that way
 *     (#1042 was exactly that),
 *   - and a literal that already existed elsewhere gives a FALSE POSITIVE —
 *     `qwen/qwen3.8-27b` "confirmed" a deploy that had not happened, because
 *     the id was already in an unrelated map.
 *
 * A sha in a known path replaces all of that.
 *
 * These assert the PROPERTIES that make the marker trustworthy, not the exact
 * text: it is written into the STAGING tree (so it swaps atomically with the
 * release, and a rollback restores the previous marker along with the previous
 * code), and it degrades to `unknown` rather than to an empty file.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = readFileSync(
  join(__dirname, '../../../scripts/deploy-selfhost.sh'),
  'utf8'
);

describe('the deploy records which commit is serving', () => {
  it('writes a .release marker', () => {
    expect(SCRIPT).toContain('.release');
    expect(SCRIPT).toMatch(/sha=\$DEPLOY_SHA/);
  });

  it('prefers the CI sha, and falls back to the working tree', () => {
    // GITHUB_SHA is the truth in CI; a local deploy still deserves an answer.
    expect(SCRIPT).toContain('${GITHUB_SHA:-');
    expect(SCRIPT).toContain('rev-parse HEAD');
  });

  it('degrades to `unknown`, never to an empty value', () => {
    // An empty marker reads as a blank truth. Absent data must look absent —
    // the same three-state discipline the catalogue check uses for "could not
    // look" versus "nothing is there".
    expect(SCRIPT).toMatch(/echo unknown/);
  });

  it('writes into the STAGING tree, so the marker swaps with the release', () => {
    // The property that makes rollback correct for free: `app-old` keeps its
    // own marker from when IT was deployed, so `mv app-old app` moves the truth
    // back with the code. Writing after the swap, or outside the release dir,
    // would leave a marker that survives a rollback and then lies.
    expect(SCRIPT).toContain('> "$ST/.release"');

    const markerAt = SCRIPT.indexOf('> "$ST/.release"');
    const swapAt = SCRIPT.indexOf('mv "$BASE/app-next" "$BASE/app"');
    expect(markerAt, 'marker write not found').toBeGreaterThan(-1);
    expect(swapAt, 'atomic swap not found').toBeGreaterThan(-1);
    expect(markerAt, 'the marker must be written BEFORE the swap').toBeLessThan(swapAt);
  });

  it('is not excluded from the rsync that ships the tree', () => {
    // A dotfile is easy to filter out by accident; the marker is worthless if
    // it never leaves the build host.
    const rsyncLine = SCRIPT.split('\n').find(l => l.includes('rsync -a --delete'));
    expect(rsyncLine, 'rsync line not found').toBeDefined();
    expect(rsyncLine).not.toContain('--exclude');
  });
});

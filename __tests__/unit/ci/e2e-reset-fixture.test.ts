/**
 * A retry path is only a recovery path if the retried thing can succeed.
 *
 * `refresh-e2e-reset-tokens.mjs` keys its disposable fixture user on
 * GITHUB_RUN_ID, which is STABLE across a re-run. So the second attempt of any
 * run that reached fixture bootstrap tried to create a user that already
 * existed, `createUser` 422'd with `email_exists`, and the job exited 1 —
 * meaning re-running CI could never succeed. That silently disabled every
 * recovery built on re-running, including the auto-merge sweep's cancelled-run
 * retries. It surfaced on 2026-08-06, when re-running main's outage-cancelled
 * CI turned a stalled merge queue into a genuinely red main.
 *
 * These lived in auto-merge-base-guard.test.ts until the sweep itself moved to
 * bitbaum/dotfiles (where its behaviour is tested against the canonical
 * script). The fixture script stayed HERE, so its guard stays here too — in its
 * own file, because the thing it tests no longer shares a file-worth of context
 * with a script this repo no longer carries.
 *
 * These are source assertions, not executions: the script is a top-level-await
 * ESM entry point that talks to Supabase on import, and jest here only
 * transforms .ts/.tsx. They still fail if someone reverts the fix, which is the
 * job.
 */
import { readFileSync } from 'node:fs';

describe('e2e reset fixture survives a re-run', () => {
  const source = readFileSync('scripts/test-setup/refresh-e2e-reset-tokens.mjs', 'utf8');

  it('keys the fixture on the attempt, not just the run', () => {
    expect(source).toContain('GITHUB_RUN_ATTEMPT');
  });

  it('treats a leftover fixture of the same tag as something to clear, not fail on', () => {
    expect(source).toContain('email_exists');
    expect(source).toContain('deleteUser');
  });
});

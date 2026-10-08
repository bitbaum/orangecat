/**
 * Main skips `verify` only when this exact tree already passed it on a PR from
 * this repository. Every other answer — no match, a fork's artifact, an API
 * error, garbage — must mean "verify". These run the REAL script against a
 * fake `gh` and a fake `git`, because the danger is a lookup that fails OPEN.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts/ci/already-verified.sh');
const TREE = 'a'.repeat(40);

function run(ghBehaviour: string, env: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'already-verified-'));
  writeFileSync(join(dir, 'git'), `#!/usr/bin/env bash\necho ${TREE}\n`);
  writeFileSync(join(dir, 'gh'), `#!/usr/bin/env bash\necho "$*" >> "${dir}/gh.log"\n${ghBehaviour}\n`);
  chmodSync(join(dir, 'git'), 0o755);
  chmodSync(join(dir, 'gh'), 0o755);
  const out = join(dir, 'out');
  writeFileSync(out, '');
  const r = spawnSync('bash', [SCRIPT], {
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      GITHUB_OUTPUT: out,
      GITHUB_REPOSITORY: 'bitbaum/orangecat',
      GITHUB_REPOSITORY_ID: '42',
      ...env,
    },
    encoding: 'utf8',
  });
  let ghLog = '';
  try {
    ghLog = readFileSync(join(dir, 'gh.log'), 'utf8');
  } catch {
    // gh never called
  }
  return { status: r.status, output: readFileSync(out, 'utf8').trim(), ghLog };
}

describe('already-verified.sh', () => {
  it('skips verify when this exact tree was recorded by a PR from this repo', () => {
    const r = run('echo 1');
    expect(r.output).toBe('verified=true');
    expect(r.status).toBe(0);
  });

  it('asks for THIS tree, and only for unexpired artifacts from THIS repository', () => {
    const r = run('echo 1');
    expect(r.ghLog).toContain(`name=verified-tree-${TREE}`);
    expect(r.ghLog).toContain('.expired == false');
    expect(r.ghLog).toContain('head_repository_id');
    expect(r.ghLog).toContain('"42"');
  });

  it('verifies when no matching artifact exists (the base moved)', () => {
    expect(run('echo 0').output).toBe('verified=false');
  });

  it('verifies when the lookup fails — a failed lookup costs time, never a check', () => {
    const r = run('exit 1');
    expect(r.output).toBe('verified=false');
    expect(r.status).toBe(0);
  });

  it('verifies when the answer is not a number', () => {
    expect(run('echo "{\\"message\\":\\"Bad credentials\\"}"').output).toBe('verified=false');
    expect(run('echo ""').output).toBe('verified=false');
  });

  it('verifies when it cannot tell which repository it is in', () => {
    expect(run('echo 1', { GITHUB_REPOSITORY_ID: '' }).output).toBe('verified=false');
  });
});

describe('ci.yml wiring', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');

  it('skips Verify only on the already-verified answer', () => {
    expect(ci).toMatch(/- name: Verify \(docs[^\n]*\n(?:\s+#[^\n]*\n)*\s+if: steps\.already\.outputs\.verified != 'true'/);
  });

  it('records a tree only for pull requests from this repository, never a fork', () => {
    expect(ci).toContain(
      "if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository"
    );
  });

  it('only asks on main, never on a pull request', () => {
    expect(ci).toMatch(/id: already\n\s+if: github\.ref == 'refs\/heads\/main'/);
  });
});

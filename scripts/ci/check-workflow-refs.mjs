#!/usr/bin/env node
/**
 * Every `uses:` that points at another repository must name that repository's
 * CANONICAL owner — not a name that merely redirects to it.
 *
 * This exists because the same outage happened twice in two days:
 *
 *   2026-08-26  the account `maonakamoto` was renamed to `catomean`
 *   2026-08-28  the repos moved to the organisation `bitbaum`
 *
 * Both times every merge and every deploy in this repo stopped, and both times
 * nothing looked wrong. GitHub redirects a renamed owner for the REST API and
 * for git remotes — `gh api repos/<old>/dotfiles` still answers, `git push` to
 * the old remote still works — so every way a human normally checks says the
 * reference is fine. The Actions resolver is the one consumer that does NOT
 * follow the redirect. It fails before any step exists, with "This run likely
 * failed because of a workflow file issue" and no readable log.
 *
 * The signal is the dangerous shape: pull requests stay GREEN, mergeable and
 * clean. The red run is on main, under a workflow nobody opens. Work simply
 * stops shipping.
 *
 * THE CHECK: ask the REST API what each referenced repo is really called. That
 * is precisely the discrepancy — REST resolves the redirect and reports the
 * canonical `full_name`, Actions does not resolve it at all. If those two
 * disagree, the workflow is already broken, whether or not it has run yet.
 *
 * A static allowlist could not do this: after a rename the workflow file and
 * the allowlist would both hold the same stale name and agree with each other.
 * Only asking GitHub what the repo is called today can tell.
 *
 * Runs in CI, where GITHUB_TOKEN is present. Skips (exit 0) without a token so
 * a local `npm run verify` does not depend on the network — CI is where this
 * has to hold.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKFLOW_DIR = '.github/workflows';
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

// CD must have one normal trigger. Main CI dispatches CD with its exact run
// artifact; CD must not also listen to workflow_run or race the sweep's
// reconciliation dispatch. Keep this invariant local and fast, before the
// network-only canonical-owner checks below.
const ciWorkflow = readFileSync(join(WORKFLOW_DIR, 'ci.yml'), 'utf8');
const cdWorkflow = readFileSync(join(WORKFLOW_DIR, 'cd.yml'), 'utf8');
const armCd = readFileSync('scripts/ci/arm-cd.sh', 'utf8');
const cdWiringProblems = [];
const liveGuard =
  cdWorkflow.split('name: Skip commit already live')[1]?.split('\n      - name:')[0] ?? '';

if (/^\s+workflow_run:/m.test(cdWorkflow)) {
  cdWiringProblems.push('cd.yml must not add a workflow_run trigger beside the CI handoff');
}
if (!/^on:\n  workflow_dispatch:/m.test(cdWorkflow)) {
  cdWiringProblems.push('cd.yml must be dispatched by main CI or the reconciler');
}
if (
  !/github\.event_name == 'workflow_dispatch'\s*\|\|\s*github\.event_name == 'push'/.test(
    ciWorkflow
  )
) {
  cdWiringProblems.push('main CI post-main handoff must run for push and workflow_dispatch');
}
if (
  !armCd.includes('-f ci_run_id="${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}"') ||
  !armCd.includes('-f ci_sha="${GITHUB_SHA:?GITHUB_SHA is required}"')
) {
  cdWiringProblems.push('arm-cd.sh must pass the successful CI run ID and SHA');
}
if (
  !cdWorkflow.includes('run-id: ${{ steps.ci.outputs.run_id }}') ||
  !cdWorkflow.includes('name: standalone-${{ steps.ci.outputs.sha }}')
) {
  cdWiringProblems.push('CD must download the artifact for the handed-off CI run and SHA');
}
if (!cdWorkflow.includes('build-and-smoke=success') || !cdWorkflow.includes('security=success')) {
  cdWiringProblems.push('CD must verify both build-and-smoke and security before deploy');
}
if (!/GH_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/.test(liveGuard)) {
  cdWiringProblems.push('CD live-SHA guard must authenticate its GitHub API request');
}
if (!/REPO:\s*\$\{\{\s*github\.repository\s*\}\}/.test(liveGuard)) {
  cdWiringProblems.push('CD live-SHA guard must pass the repository to its GitHub API request');
}
if (cdWiringProblems.length > 0) {
  console.error('[check-cd-wiring] FAIL');
  for (const problem of cdWiringProblems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(
  '[check-cd-wiring] OK — one main-CI handoff, exact artifact, no competing workflow_run trigger.'
);

if (!token) {
  console.log('[check-workflow-refs] no GITHUB_TOKEN — skipping (this gate runs in CI)');
  process.exit(0);
}

/**
 * `uses: owner/repo/path@ref` and `uses: owner/repo@ref`.
 * Local (`./.github/...`) and container (`docker://`) references have no owner
 * to be wrong about, so they are not matched.
 */
const USES = /^\s*uses:\s*([A-Za-z0-9][\w.-]*)\/([\w.-]+)(?:\/[^@\s]+)?@/gm;

const refs = new Map(); // "owner/repo" -> Set of workflow files

for (const file of readdirSync(WORKFLOW_DIR).filter(f => /\.ya?ml$/.test(f))) {
  const text = readFileSync(join(WORKFLOW_DIR, file), 'utf8');
  for (const [, owner, repo] of text.matchAll(USES)) {
    const key = `${owner}/${repo}`;
    refs.set(key, (refs.get(key) ?? new Set()).add(file));
  }
}

const problems = [];
let checked = 0;

for (const [ref, files] of refs) {
  const res = await fetch(`https://api.github.com/repos/${ref}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'orangecat-check-workflow-refs',
    },
  });

  if (res.status === 404) {
    problems.push(`${ref} does not exist (referenced by ${[...files].join(', ')})`);
    continue;
  }

  if (!res.ok) {
    // Rate limiting or an outage is "could not look", never "looks fine".
    console.error(`[check-workflow-refs] could not resolve ${ref}: HTTP ${res.status}`);
    process.exit(2);
  }

  const { full_name: canonical } = await res.json();
  checked += 1;

  if (canonical.toLowerCase() !== ref.toLowerCase()) {
    problems.push(
      `${ref} is a REDIRECT to ${canonical} — REST and git follow it, the Actions ` +
        `resolver does NOT, so ${[...files].join(', ')} will fail to load with no ` +
        `usable log. Change the reference to ${canonical}.`
    );
  }
}

if (problems.length > 0) {
  console.error('[check-workflow-refs] FAIL');
  for (const p of problems) {
    console.error(`  ${p}`);
  }
  process.exit(1);
}

console.log(`[check-workflow-refs] OK — ${checked} external workflow reference(s), all canonical.`);

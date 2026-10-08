#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * verify.mjs — the one definition of "verified", run in lanes.
 *
 * `verify` used to be twenty-four `pnpm run` steps chained with `&&`, so every
 * one waited for the one before it — although nothing in the chain reads what
 * an earlier step produced. Measured in CI on 2026-10-07 the chain took ~280s:
 * unit tests 151s, eslint 51s, the two type-checks 31s + 32s, everything else
 * ~10s. CI runs it twice per change (on the PR, then on main) before a deploy,
 * so that serial wait was most of the time between "merged" and "live".
 *
 * The steps fall into three independent lanes — the test suite, the type
 * checks, and lint plus the static checks — and the wall time is the longest
 * lane rather than the sum of all of them.
 *
 * How many lanes run at once is a property of the MACHINE, not of the checks:
 *   - CI (a clean runner): all lanes at once.
 *   - Locally: one lane, i.e. the old serial order with live output. A laptop
 *     running a dozen agent sessions OOM-killed these gates when they ran side
 *     by side; serial is the safe default there.
 *   - `VERIFY_LANES=<n>` overrides either.
 *
 * The CHECKS are identical in every mode — this file is still the single list
 * CI calls verbatim. Only the scheduling differs.
 */
import { spawn } from 'node:child_process';

/** Each lane runs its steps in order; lanes run side by side. */
export const LANES = [
  ['test:unit'],
  ['type-check', 'type-check:scripts'],
  [
    'ci:docs',
    'check:file-inputs',
    'check:accent-ink',
    'check:sizes',
    'audit:routes',
    'lint',
    'check:duplication',
    'check:dead-fields',
    'check:dead-labels',
    'check:migration-versions',
    'check:schema-columns',
    'check:currency-units',
    'check:rpc-exists',
    'check:one-current-user',
    'check:app-locale',
    'check:type-scale',
    'check:client-ip',
    'check:user-scoped-deletes',
    'check:content',
    'check:changelog',
    'check:follow-envelope',
  ],
];

/** The order `verify` has always run in, kept for serial mode. */
export const SERIAL = [
  'ci:docs',
  'check:file-inputs',
  'check:accent-ink',
  'type-check',
  'type-check:scripts',
  'check:sizes',
  'audit:routes',
  'lint',
  'check:duplication',
  'check:dead-fields',
  'check:dead-labels',
  'check:migration-versions',
  'check:schema-columns',
  'check:currency-units',
  'check:rpc-exists',
  'check:one-current-user',
  'check:app-locale',
  'check:type-scale',
  'check:client-ip',
  'check:user-scoped-deletes',
  'check:content',
  'check:changelog',
  'check:follow-envelope',
  'test:unit',
];

function laneCount() {
  const asked = Number.parseInt(process.env.VERIFY_LANES ?? '', 10);
  if (Number.isInteger(asked) && asked > 0) {
    return asked;
  }
  return process.env.CI === 'true' ? LANES.length : 1;
}

/** Run one `pnpm run <step>`; `live` streams output, otherwise it is captured. */
function run(step, live) {
  const started = Date.now();
  return new Promise(resolve => {
    const child = spawn('pnpm', ['run', step], {
      stdio: live ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    const chunks = [];
    if (!live) {
      child.stdout.on('data', c => chunks.push(c));
      child.stderr.on('data', c => chunks.push(c));
    }
    child.on('close', code => {
      resolve({ step, ok: code === 0, seconds: (Date.now() - started) / 1000, output: Buffer.concat(chunks).toString() });
    });
  });
}

async function runLane(steps, live, results) {
  for (const step of steps) {
    if (!live) {
      console.log(`▶ ${step}`);
    }
    const result = await run(step, live);
    results.push(result);
    if (!live) {
      // Captured output is printed whole when the step ends, so lanes never
      // interleave mid-line in the log.
      console.log(`${result.ok ? '✓' : '✗'} ${step} (${result.seconds.toFixed(1)}s)`);
      if (!result.ok || process.env.VERIFY_VERBOSE) {
        process.stdout.write(result.output);
      }
    }
    if (!result.ok) {
      return; // the rest of THIS lane depends on nothing, but a red lane is red
    }
  }
}

async function main() {
  const lanes = laneCount();
  const results = [];
  const started = Date.now();

  if (lanes === 1) {
    await runLane(SERIAL, true, results);
  } else {
    console.log(`verify: ${LANES.length} lanes in parallel (VERIFY_LANES=1 for serial)`);
    await Promise.all(LANES.map(steps => runLane(steps, false, results)));
  }

  const failed = results.filter(r => !r.ok);
  const wall = (Date.now() - started) / 1000;
  console.log('\nverify timings (slowest first):');
  for (const r of [...results].sort((a, b) => b.seconds - a.seconds).slice(0, 8)) {
    console.log(`  ${r.seconds.toFixed(1).padStart(6)}s  ${r.ok ? ' ' : '✗'} ${r.step}`);
  }
  console.log(`  ${wall.toFixed(1).padStart(6)}s  wall`);

  if (failed.length > 0) {
    console.error(`\nverify FAILED: ${failed.map(r => r.step).join(', ')}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

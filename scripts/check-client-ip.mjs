#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * check-client-ip.mjs — nothing parses `x-forwarded-for` except the one helper.
 *
 * `X-Forwarded-For` is a LIST, and Caddy APPENDS to it. A request that reached
 * us through Caddy carries `<whatever the caller sent>, <what Caddy actually
 * saw>`, so the only entry the caller cannot forge is the LAST one.
 *
 * Six places in this repo read it, and every one of them read it wrong:
 *
 *   - `rate-limit.ts` used the header WHOLE, so any value at all was a new key;
 *   - three payment routes each copied `split(',')[0]` — the caller's own value;
 *   - the entity audit log recorded that value, an audit trail the subject
 *     writes;
 *   - the captcha route forwarded it to the provider as `remoteip`.
 *
 * The limiter consequence is the sharp one: vary the header per request and
 * every request lands in a fresh bucket, so no bucket ever fills. That is not a
 * weakened limiter, it is no limiter, while the route reads as protected — and
 * on `/api/v1/pay/...` and `POST /api/v1/payments/public` each such request
 * mints a real Lightning invoice through the recipient's own wallet, which is
 * how you get a seller rate-limited by their wallet provider.
 *
 * Six instances is far past the point where fixing them one more time is the
 * answer. `clientIpKey()` in src/lib/client-ip.ts is the single definition —
 * since 2026-09-05 it delegates the parsing to `limitkit`'s `clientIp()`
 * (which once carried the identical bug for the same reason, fixed in 0.2.0) —
 * and this gate keeps it single. See bitbaum/orangecat#563 finding 2.
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// The one file allowed to look at the raw header: the definition itself.
const OWNER = 'src/lib/client-ip.ts';

// Any read of the header. Deliberately broad — the failure was never one
// spelling, it was six people each reaching for the header directly.
const PATTERN = /['"`]x-forwarded-for['"`]/i;

const files = execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx'", { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter(f => f !== OWNER);

const offenders = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (PATTERN.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
  });
}

if (offenders.length > 0) {
  console.error('✗ x-forwarded-for is read outside the one helper that knows which hop to trust:');
  for (const o of offenders) console.error(`    ${o}`);
  console.error('');
  console.error(`  Caddy APPENDS to that header, so the first entry is whatever the caller`);
  console.error(`  sent and only the last one is evidence. Use clientIpKey(request) from`);
  console.error(`  ${OWNER} — it counts from the right and falls back honestly.`);
  console.error('');
  console.error('  A limiter keyed on a caller-controlled value can never be tripped.');
  process.exit(1);
}

console.log(`✓ client IP: ${files.length} file(s) checked, x-forwarded-for read only in ${OWNER}`);

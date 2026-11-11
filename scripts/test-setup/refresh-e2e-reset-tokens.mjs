#!/usr/bin/env node
/**
 * Mint a DISPOSABLE per-run user + fresh password-reset session tokens for
 * the reset E2E test.
 *
 * Why per-run: the reset flow consumes a single-use recovery token and then
 * CHANGES the password. Pointed at the shared fixture user, concurrent CI
 * runs invalidated each other's tokens (GoTrue keeps one recovery token per
 * user) and flipped the shared password mid-run — the 2026-08-02 "flake"
 * cluster. A unique throwaway user per run makes concurrency irrelevant.
 * Old throwaways (>1 day) are cleaned up opportunistically each run.
 *
 * Prints GitHub Actions env lines when GITHUB_ENV is set, else shell exports.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import ws from 'ws';
import { createClient } from '@supabase/supabase-js';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Unique per ATTEMPT (workflow run id + attempt in CI, pid+time locally) so no
// other run can touch this user's recovery token or password.
//
// The attempt number is not decoration. GITHUB_RUN_ID is stable across a
// re-run, so keying on it alone meant the second attempt of any run that got
// this far tried to create a user that already existed — `createUser` 422s with
// `email_exists` and the job exits 1. Effect: **re-running CI could never
// succeed**, which silently disabled every recovery path built on re-running,
// including auto-merge-sweep.sh's cancelled-run retry (added for #603/#604) and
// its base-branch twin. It surfaced on 2026-08-06 when an Actions outage
// cancelled main's CI and re-running it turned a stalled queue into a red main.
const runTag = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT || '1'}`
  : `${process.pid}-${Date.now()}`;
const email = `e2e-reset-${runTag}@orangecat.ch`;

if (!url || !serviceKey || !anonKey) {
  console.error('Missing Supabase env for reset token refresh');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws },
});

// Opportunistic cleanup of yesterday's throwaway reset users. Best-effort —
// a failure here must never block the run.
//
// This deletes the AUTH user; the profile row goes with it via
// profiles.profiles_id_fkey ON DELETE CASCADE (migration 20260806150000).
// Before that constraint existed the profile survived every deletion, so this
// loop ran successfully for two months while quietly leaving 113 orphaned
// profiles in production — 73% of the profiles table, which made the platform's
// signup numbers mostly synthetic. If that constraint is ever dropped, this
// script silently starts leaking again; the nightly `profiles.orphaned`
// invariant is what would notice.
//
// The actor does NOT go with it. `actors.user_id` is the one member of this
// family still carrying no foreign key, so it has to be deleted by hand here.
// See the `actors.orphaned` invariant for why an FK is not a drive-by fix.
try {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    const users = data?.users ?? [];
    for (const u of users) {
      if (/^e2e-reset-/.test(u.email || '') && new Date(u.created_at).getTime() < cutoff) {
        // Actor first: it is the row nothing else will clean up, so if the
        // deletion fails part-way the auth user is left behind as the marker
        // that cleanup is unfinished, rather than an actor with no account to
        // find it by.
        await admin.from('actors').delete().eq('user_id', u.id);
        await admin.auth.admin.deleteUser(u.id);
        console.log(`cleaned up stale reset user ${u.email}`);
      }
    }
    if (users.length < 100) break;
  }
} catch (e) {
  console.warn('stale reset-user cleanup skipped:', e?.message ?? e);
}

// The runner reaches the self-hosted auth server over the internet; one dropped
// request ("AuthRetryableFetchError: fetch failed", status 0) failed main's CI
// on 2026-10-27 although nothing was wrong. Only a request that never got an
// answer is retried; a real refusal (email_exists, a bad key) comes straight back.
async function createResetUser() {
  let result;
  for (let attempt = 1; attempt <= 3; attempt++) {
    result = await createResetUserOnce();
    if (result.error?.status !== 0) return result;
    console.warn(`createUser got no answer (attempt ${attempt}/3)`);
    await new Promise(r => setTimeout(r, attempt * 1500));
  }
  return result;
}

async function createResetUserOnce() {
  return admin.auth.admin.createUser({
    email,
    password: `Reset-${runTag}-Aa1!`,
    email_confirm: true,
    user_metadata: { preferred_username: `e2e_reset_${runTag}`, name: 'E2E Reset User' },
  });
}

let { error: createErr } = await createResetUser();

// Belt and braces for the same class the attempt suffix above fixes: this
// fixture is disposable by definition, so a leftover of the SAME tag is
// something to clear, never something to fail on. Anything that makes CI
// unrunnable twice in a row disables every retry-based recovery path we have.
if (createErr?.code === 'email_exists') {
  console.warn(`reset fixture ${email} already existed — replacing it`);
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
  const stale = (data?.users ?? []).find(u => u.email === email);
  if (stale) {
    await admin.auth.admin.deleteUser(stale.id);
  }
  ({ error: createErr } = await createResetUser());
}

if (createErr) {
  console.error('createUser for reset fixture failed', createErr);
  process.exit(1);
}
console.log(`created disposable reset user ${email}`);

const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: 'recovery',
  email,
});
if (linkErr || !linkData?.properties?.hashed_token) {
  console.error('generateLink failed', linkErr);
  process.exit(1);
}

const client = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws },
});

const { data: sessionData, error: otpErr } = await client.auth.verifyOtp({
  type: 'recovery',
  token_hash: linkData.properties.hashed_token,
});

if (otpErr || !sessionData?.session) {
  console.error('verifyOtp failed', otpErr);
  process.exit(1);
}

const accessToken = sessionData.session.access_token;
const refreshToken = sessionData.session.refresh_token;
const githubEnv = process.env.GITHUB_ENV;

if (githubEnv) {
  fs.appendFileSync(githubEnv, `E2E_RESET_ACCESS_TOKEN=${accessToken}\n`);
  fs.appendFileSync(githubEnv, `E2E_RESET_REFRESH_TOKEN=${refreshToken}\n`);
}

console.log(`E2E_RESET_ACCESS_TOKEN=${accessToken}`);
console.log(`E2E_RESET_REFRESH_TOKEN=${refreshToken}`);

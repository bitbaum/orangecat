#!/usr/bin/env node
/**
 * Wallet routing eval — can the Cat actually make someone payable?
 *
 * PR #641 added `connect_wallet` (the setup verb: store the Lightning address /
 * Bitcoin address / NWC string a user pastes, so they can RECEIVE) alongside the
 * older `add_wallet` (a savings goal on top of a rail they already have). Unit
 * tests cover the registry, the handler, the permission default and the
 * disambiguation rules. None of them prove the DEPLOYED MODEL picks the right
 * verb — and that is the whole feature: an action nobody routes to is an action
 * that does not exist. `add_wallet` has a full worked example in the prompt;
 * `connect_wallet` only gets a generated one-liner in the appendix, so the two
 * are not competing on equal footing and a prompt edit could tip it silently.
 *
 * This probes the REAL deployed endpoint (POST /api/cat/chat, streaming SSE) and
 * scores which action came back.
 *
 * ── Why it creates its own user ─────────────────────────────────────────────
 * The interesting behaviour only exists for someone who CANNOT be paid: the
 * provider list and the two-branch repair instructions are rendered into the
 * user context by renderPaymentCapabilities ONLY when there is no receiving
 * rail. Running these probes as the shared eval fixture (who has a Lightning
 * address) reports a false failure — the Cat correctly never sees the section,
 * falls back on its own priors, and recommends wallets that do not hand out a
 * Lightning address at all. That happened on the first run of this harness.
 *
 * So each run mints a throwaway confirmed auth user, probes, and deletes it.
 * Deleting the auth user is enough: profiles cascade since PR #637, and the
 * final check asserts zero rows survive (a cheap live re-test of that cascade).
 *
 * Deliberately NOT part of `npm run verify` and NOT on a timer: it costs a model
 * call per probe and needs network + service-role credentials. Run it when
 * connect_wallet / add_wallet, their registry descriptions, the payment
 * capabilities context or the prompt's action catalog change.
 *
 *   node scripts/eval-wallet-routing.mjs
 *
 * Exit codes: 0 = pass · 1 = regression · 2 = harness error.
 *
 * Env (same conventions as eval-cat.mjs, .env.local as local fallback):
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY   mints and deletes the throwaway user
 *   WALLET_EVAL_BASE_URL        target app (default https://orangecat.ch)
 *   CAT_EVAL_PROVIDER / CAT_EVAL_MODEL   pinned provider+model (see eval-cat.mjs)
 */

import { readFileSync, existsSync } from 'node:fs';
import { buildAuthCookie as buildSharedAuthCookie } from './eval-auth.mjs';

// .env.local is a local-dev fallback only — real env always wins.
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = process.env.WALLET_EVAL_BASE_URL || 'https://orangecat.ch';
const EVAL_PROVIDER = process.env.CAT_EVAL_PROVIDER || 'openrouter';
// Must stay in step with eval-cat.mjs / DEFAULT_FREE_MODEL_ID — the eval should
// measure the model real users are served, not a better one.
const EVAL_MODEL =
  process.env.CAT_EVAL_MODEL ||
  (EVAL_PROVIDER === 'groq' ? 'llama-3.3-70b-versatile' : 'nvidia/nemotron-3-ultra-550b-a55b:free');

const PROBE_TIMEOUT_MS = 120_000;
const INTER_PROBE_DELAY_MS = 8_000;
const MAX_ATTEMPTS = 4;
// The free pool answers "Free AI capacity is maxed out right now" under load and
// clears itself within a couple of minutes. Without a retry the harness scores
// that as a routing regression — provider congestion wearing the costume of a
// verdict, which is exactly the failure this eval exists to rule out. Backoff
// copied from eval-cat.mjs, whose last step had to reach 90s to match what the
// provider actually asks for.
const RETRY_BACKOFF_MS = [20_000, 45_000, 90_000];
/** Errors that say "the provider was busy", never "the Cat chose wrong". */
const TRANSIENT_RE = /capacity is maxed|rate.?limit|429|502|503|504|timeout|ECONNRESET|fetch failed/i;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('eval-wallet-routing: missing SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY in env');
  process.exit(2);
}

/**
 * The states a person is actually in when money comes up.
 *
 * `expectAction` scores the action the Cat emitted; `expectProviders` scores the
 * reply text against the SSOT list in src/config/wallet-providers.ts. The
 * provider probe is the one that catches the Cat freelancing wallet names from
 * its training priors — the failure mode there is recommending a wallet that
 * supports Lightning but never hands out an ADDRESS, which leaves the user
 * exactly as unpayable as before while sounding like an answer.
 *
 * `rail` says which state the probe user must be in. It is not a detail: on a
 * user with NO rail the Cat is INSTRUCTED to defer a savings goal ("the goal has
 * nowhere to be funded") — so scoring the add_wallet control against an
 * unpayable user marks correct behaviour as a regression. Both states have to be
 * staged explicitly or the harness lies in one direction or the other.
 */
const PROBES = [
  {
    id: 'paste-lightning-address',
    label: 'Pastes a Lightning address → connect_wallet',
    rail: 'none',
    message: "Here's my lightning address: newbie@coinos.io — set me up so people can pay me.",
    expectAction: 'connect_wallet',
  },
  {
    id: 'no-wallet-at-all',
    label: 'Has no wallet → the SSOT providers, and nothing else',
    rail: 'none',
    message: "I don't have a bitcoin wallet at all. How do I get paid on here?",
    // Names, not URLs: the Cat reformats links but rarely renames a provider.
    expectProviders: ['Coinos', 'Primal', 'Alby'],
    forbidProviders: ['Wallet of Satoshi', 'BlueWallet', 'Phoenix', 'Muun', 'Cash App'],
  },
  {
    id: 'savings-goal-control',
    label: 'CONTROL — with a rail, a savings goal is still add_wallet',
    rail: 'lightning',
    message: 'I want to set a savings goal of 0.05 BTC for a new kiln.',
    expectAction: 'add_wallet',
  },
];

/** The address staged for `rail: 'lightning'` probes. Never used to pay anyone. */
const STAGED_LIGHTNING_ADDRESS = 'wallet-eval@coinos.io';

const svcHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

const REST_RETRIES = 4;
const REST_BACKOFF_MS = 1500;

/**
 * PostgREST call with the same transient tolerance as eval-cat.mjs. A dropped
 * connection or a schema-cache 503 anywhere in here does not throw a verdict —
 * it killed a whole run with "harness error — fetch failed" before this existed,
 * losing the two probes that had already passed. 4xx is a real answer about the
 * request and is never retried.
 */
async function rest(method, path, { body, prefer } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= REST_RETRIES; attempt++) {
    let res;
    try {
      res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method,
        headers: { ...svcHeaders, ...(prefer ? { Prefer: prefer } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      lastErr = new Error(`PostgREST ${method} ${path} → transport: ${err.message}`);
      await restBackoff(attempt, 'transport');
      continue;
    }
    if (res.ok) {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    }
    const detail = await res.text();
    lastErr = new Error(`PostgREST ${method} ${path} → ${res.status}: ${detail}`);
    if (res.status < 500) {
      throw lastErr;
    }
    await restBackoff(attempt, `${res.status}`);
  }
  throw lastErr;
}

async function restBackoff(attempt, why) {
  if (attempt >= REST_RETRIES) {
    return;
  }
  const wait = REST_BACKOFF_MS * attempt;
  console.error(
    `eval-wallet-routing: PostgREST transient (${why}) — retry ${attempt}/${REST_RETRIES - 1} in ${wait}ms`
  );
  await new Promise(r => setTimeout(r, wait));
}

/** Cookie forging shared with the other evals (eval-auth.mjs). */
const buildAuthCookie = session => buildSharedAuthCookie(SUPABASE_URL, session);

async function runProbe(probe, cookie, conversationId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const out = { content: '', actions: [], error: null };
  try {
    const res = await fetch(`${BASE_URL}/api/cat/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        'x-cat-eval-lock-model': '1',
        'x-cat-eval-provider': EVAL_PROVIDER,
      },
      body: JSON.stringify({
        message: probe.message,
        model: EVAL_MODEL,
        stream: true,
        conversationId,
        locale: 'en',
        preferredCurrency: 'CHF',
      }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      out.error = `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`;
      return out;
    }
    const decoder = new TextDecoder();
    let buf = '';
    for await (const chunk of res.body) {
      buf += decoder.decode(chunk, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const isError = /^event: ?error$/m.test(frame);
        const dataLine = frame.split('\n').find(l => l.startsWith('data: '));
        if (!dataLine) {
          continue;
        }
        let payload;
        try {
          payload = JSON.parse(dataLine.slice(6));
        } catch {
          continue;
        }
        if (isError) {
          out.error = payload.error || JSON.stringify(payload).slice(0, 300);
          continue;
        }
        if (typeof payload.content === 'string') {
          out.content += payload.content;
        }
        if (Array.isArray(payload.actions)) {
          out.actions = payload.actions;
        }
      }
    }
  } catch (err) {
    out.error = err.name === 'AbortError' ? `timeout after ${PROBE_TIMEOUT_MS}ms` : String(err);
  } finally {
    clearTimeout(timer);
  }
  return out;
}

/** runProbe, but a busy provider buys another attempt instead of a failing grade. */
async function runProbeWithRetry(probe, cookie, conversationId) {
  let result;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    result = await runProbe(probe, cookie, conversationId);
    if (!result.error || !TRANSIENT_RE.test(result.error) || attempt === MAX_ATTEMPTS) {
      return result;
    }
    const wait = RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)];
    console.error(
      `eval-wallet-routing: ${probe.id} transient (${result.error.slice(0, 60)}…) — retry ${attempt}/${MAX_ATTEMPTS - 1} in ${wait}ms`
    );
    await sleep(wait);
  }
  return result;
}

function scoreProbe(probe, result) {
  const ids = result.actions.map(a => a.actionId || a.action_id || a.id).filter(Boolean);
  if (probe.expectAction) {
    return {
      ok: ids.includes(probe.expectAction),
      detail: `expected ${probe.expectAction}, got [${ids.join(', ') || 'none'}]`,
    };
  }
  // A provider name only counts as a RECOMMENDATION when it appears somewhere
  // other than an example address — "satoshi@coinos.io" as a placeholder is not
  // the Cat telling anyone to use Coinos, and scoring it as one is how the first
  // run of this harness produced a false pass.
  const prose = result.content.replace(/\b[\w.+-]+@[\w.-]+\b/g, '');
  const hits = probe.expectProviders.filter(p => new RegExp(p, 'i').test(prose));
  const strays = (probe.forbidProviders ?? []).filter(p => new RegExp(p, 'i').test(prose));
  return {
    ok: hits.length === probe.expectProviders.length && strays.length === 0,
    detail:
      `SSOT providers named: [${hits.join(', ') || 'none'}] of ` +
      `[${probe.expectProviders.join(', ')}]` +
      (strays.length ? ` — off-registry: [${strays.join(', ')}]` : ''),
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  // The probes only mean anything for a user with NO receiving rail, so mint one.
  const email = `cat-wallet-eval-${process.pid}-${Date.now()}@example.com`;
  const password = 'walletEvalPassword!123';
  const created = await (
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: svcHeaders,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: 'Wallet Eval' },
      }),
    })
  ).json();
  const userId = created.id;
  if (!userId) {
    console.error(
      `eval-wallet-routing: could not mint probe user — ${JSON.stringify(created).slice(0, 300)}`
    );
    process.exit(2);
  }
  console.error(`eval-wallet-routing: minted throwaway user ${userId}`);

  let failures = 0;
  try {
    const session = await (
      await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    ).json();
    if (!session.access_token) {
      throw new Error(`sign-in failed: ${JSON.stringify(session).slice(0, 200)}`);
    }
    const cookie = buildAuthCookie(session);

    const scored = [];
    let stagedRail = 'none';
    for (const probe of PROBES) {
      // Stage the receiving rail this probe is written for.
      if (probe.rail !== stagedRail) {
        if (probe.rail === 'lightning') {
          await rest('POST', 'wallets', {
            body: {
              profile_id: userId,
              user_id: userId,
              label: 'Wallet eval rail',
              lightning_address: STAGED_LIGHTNING_ADDRESS,
              is_active: true,
              is_primary: true,
            },
            prefer: 'return=minimal',
          });
        } else {
          await rest('DELETE', `wallets?profile_id=eq.${userId}`, { prefer: 'return=minimal' });
        }
        stagedRail = probe.rail;
      }

      // Each probe gets its own conversation so history can't contaminate the
      // next — but cat_memories are recalled per USER, so a separate
      // conversation is not enough on its own. Without this purge the address
      // pasted in probe 1 came back as a recalled fact in probe 3 and changed
      // its answer. Same contamination eval-cat.mjs purges between probes.
      await rest('DELETE', `cat_memories?user_id=eq.${userId}`, { prefer: 'return=minimal' });
      const rows = await rest('POST', 'cat_conversations', {
        body: { user_id: userId, title: `[eval] ${probe.id}`, is_default: false },
        prefer: 'return=representation',
      });
      const result = await runProbeWithRetry(probe, cookie, rows[0].id);
      console.log(`\n─── ${probe.label}`);
      console.log(`    > ${probe.message}`);
      if (result.error) {
        console.log(`    ✗ ERROR: ${result.error}`);
        scored.push({ probe, score: { ok: false, detail: result.error } });
      } else {
        console.log(`    reply: ${result.content.replace(/\s+/g, ' ').slice(0, 400)}`);
        scored.push({ probe, score: scoreProbe(probe, result) });
      }
      await sleep(INTER_PROBE_DELAY_MS);
    }

    console.log('\n════ VERDICT ════');
    for (const { probe, score } of scored) {
      if (!score.ok) {
        failures++;
      }
      console.log(`${score.ok ? '✓' : '✗'} ${probe.id} — ${score.detail}`);
    }
  } finally {
    // Delete everything this run wrote, explicitly, and only THEN the user.
    //
    // The first version assumed deleting the auth user was the whole cleanup
    // and asserted it by checking `profiles` came back empty. It always did —
    // profiles cascade since #637 — so the check passed on every run while
    // `cat_conversations` quietly orphaned: 20 rows, 7 vanished owners, found
    // only by going and looking. The assertion proved the thing already fixed
    // rather than the thing being done, which is the failure mode to watch for
    // whenever a cleanup check is written next to a recent cascade fix.
    //
    // So: own the rows. Every table below is one this harness writes to.
    for (const { id } of (await rest('GET', `cat_conversations?user_id=eq.${userId}&select=id`)) ??
      []) {
      await rest('DELETE', `cat_messages?conversation_id=eq.${id}`, { prefer: 'return=minimal' });
    }
    for (const path of [
      `cat_conversations?user_id=eq.${userId}`,
      `cat_memories?user_id=eq.${userId}`,
      `cat_pending_actions?user_id=eq.${userId}`,
      `wallets?profile_id=eq.${userId}`,
    ]) {
      await rest('DELETE', path, { prefer: 'return=minimal' });
    }
    const del = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: svcHeaders,
    });

    // Verify per table, not by proxy. `profiles` is still checked because that
    // one IS a cascade and re-testing it live every run is free.
    const leftovers = [];
    for (const [label, path] of [
      ['profiles', `profiles?id=eq.${userId}&select=id`],
      ['cat_conversations', `cat_conversations?user_id=eq.${userId}&select=id`],
      ['cat_memories', `cat_memories?user_id=eq.${userId}&select=id`],
      ['wallets', `wallets?profile_id=eq.${userId}&select=id`],
    ]) {
      const rows = await rest('GET', path);
      if (rows?.length) {
        leftovers.push(`${label}=${rows.length}`);
      }
    }
    console.error(
      `eval-wallet-routing: deleted probe user (${del.status}); leftovers: ${leftovers.join(', ') || 'none'}`
    );
    if (leftovers.length) {
      console.error('eval-wallet-routing: CLEANUP INCOMPLETE — probe user left rows behind');
      failures++;
    }
  }

  process.exit(failures > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('eval-wallet-routing: harness error —', err.message);
  process.exit(2);
});

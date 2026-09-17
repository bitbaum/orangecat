#!/usr/bin/env node
/**
 * Cat OUTCOME eval — grades the Cat on reality, not on rubric.
 *
 * Complements eval-cat.mjs (nightly synthetic judgment probes): where that one
 * asks "did Cat propose the right entity type?", this one asks "what happened
 * to what Cat created?" — the platform-wide funnel over a window:
 *
 *     proposed  (completed create_* rows in cat_action_log)
 *   → published (entity currently status=active)
 *   → funded    (≥1 settled payment_intent toward the entity)
 *
 * Everything is derived from existing tables via PostgREST with the service
 * key. No LLM involved: settlement is ground truth no judge can hallucinate.
 *
 * Also acts as the REGRESSION GUARD for the "audit trail silently dead" class
 * (cat_action_log had no INSERT RLS policy for months — every write failed
 * silently): with --gate, exits 1 when the window shows Cat assistant activity
 * (cat_messages) but the action log is EMPTY — the exact signature of that bug.
 * NOT when the log has rows and merely no completed create_*: that is a funnel
 * fact (nothing creatable was asked for, or every attempt was denied), and
 * conflating the two made this gate fail nightly while the write path was fine.
 *
 * Usage:
 *   node scripts/eval-cat-outcomes.mjs               # report, exit 0
 *   node scripts/eval-cat-outcomes.mjs --gate        # + dead-audit-trail gate
 *   OUTCOME_WINDOW_DAYS=90 node scripts/eval-cat-outcomes.mjs
 *   OUTCOME_JSON_OUT=/tmp/outcomes.json node scripts/eval-cat-outcomes.mjs
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * (.env.local fallback for local runs, EnvironmentFile on the box).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function loadLocalEnvFallback() {
  if (!existsSync('.env.local')) {
    return;
  }
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadLocalEnvFallback();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WINDOW_DAYS = Number(process.env.OUTCOME_WINDOW_DAYS || 30);
const JSON_OUT = process.env.OUTCOME_JSON_OUT || null;
const GATE = process.argv.includes('--gate');

function requireEnv() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('eval-cat-outcomes: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(2);
  }
}

/**
 * Entity-creating Cat actions → their tables. MUST mirror
 * src/config/entity-registry.ts (guarded by
 * __tests__/unit/scripts/eval-cat-outcomes-map.test.ts — if the registry
 * changes, that test fails and points here).
 */
const CREATE_ACTION_TABLES = {
  create_product: 'user_products',
  create_service: 'user_services',
  create_project: 'projects',
  create_cause: 'user_causes',
  create_event: 'events',
  create_asset: 'assets',
  create_loan: 'loans',
  create_investment: 'investments',
  create_ai_assistant: 'ai_assistants',
};

const SETTLED_INTENT_STATUSES = 'paid,buyer_confirmed';

// ---------------------------------------------------------------------------
// PostgREST helpers (service key — this is an offline operator script)
// ---------------------------------------------------------------------------

async function rest(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`PostgREST ${res.status} on ${path.split('?')[0]}: ${await res.text()}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

/**
 * Decide whether zero *completed create_** rows means the audit trail is dead.
 *
 * It usually does not. On 2026-08-29 this gate failed nightly with "the
 * cat_action_log write path looks dead (check RLS policies and the executor)"
 * while the log held ten rows for the window, the newest from 2026-08-25 — the
 * write path was demonstrably alive. `proposed` counts only rows that are BOTH
 * `status=completed` AND a `create_*` action, and in that window there were
 * none: the single create_* was `create_cause`, DENIED. Three different worlds
 * produce proposed === 0:
 *
 *   1. nothing is written at all           → the audit trail is dead. Page.
 *   2. writes happen, no completed creates → users asked for nothing creatable,
 *                                            or every attempt was denied. A
 *                                            funnel fact. Not an outage.
 *   3. no assistant activity at all        → nothing to grade.
 *
 * The old predicate could not see the difference between 1 and 2, so it
 * asserted a cause it had never tested — and a tripwire that cries every night
 * is one nobody believes on the night it is right. So the gate now fails only
 * on the shape it was actually built for: the log is EMPTY while the Cat is
 * talking.
 */
export function gateVerdict({ proposed, hasAssistantActivity, logRows }) {
  if (proposed > 0) {
    return { fail: false, message: `gate: ${proposed} completed create_* action(s) in window.` };
  }
  if (!hasAssistantActivity) {
    return { fail: false, message: 'gate: no assistant activity in window either — nothing to grade, pass.' };
  }
  const rows = logRows || [];
  if (rows.length === 0) {
    return {
      fail: true,
      message:
        'GATE FAILED: assistant messages exist in the window but cat_action_log is EMPTY — ' +
        'the write path looks dead (check RLS policies and the executor).',
    };
  }
  const byStatus = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }
  const summary = Object.entries(byStatus)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
  const denied = byStatus.denied || 0;
  return {
    fail: false,
    message:
      `gate: the write path is alive — ${rows.length} action(s) logged in window (${summary}), ` +
      `just none of them a completed create_*. Not an outage.` +
      (denied > 0 ? ` NOTE: ${denied} were DENIED — worth a look if that is unexpected.` : ''),
  };
}

// ---------------------------------------------------------------------------
// Funnel
// ---------------------------------------------------------------------------

async function main() {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const actionFilter = Object.keys(CREATE_ACTION_TABLES).join(',');

  const logRows = await rest(
    `cat_action_log?select=action_id,result,user_id,completed_at` +
      `&status=eq.completed&action_id=in.(${actionFilter})&created_at=gte.${since}` +
      `&order=created_at.desc&limit=1000`
  );

  const proposals = logRows
    .map(r => ({
      actionId: r.action_id,
      table: CREATE_ACTION_TABLES[r.action_id],
      entityId: r.result && typeof r.result.id === 'string' ? r.result.id : null,
    }))
    .filter(p => p.table && p.entityId);

  // Outcome 1: current entity status, batched per table.
  const byTable = new Map();
  for (const p of proposals) {
    byTable.set(p.table, [...(byTable.get(p.table) || []), p.entityId]);
  }
  const statusById = new Map();
  for (const [table, ids] of byTable) {
    try {
      const rows = await rest(`${table}?select=id,status&id=in.(${ids.join(',')})`);
      for (const row of rows) {
        statusById.set(row.id, row.status);
      }
    } catch (err) {
      console.error(`  ! status lookup failed for ${table}: ${err.message}`);
    }
  }

  // Outcome 2: settled funding toward those entities.
  const fundedById = new Map();
  if (proposals.length > 0) {
    try {
      const intents = await rest(
        `payment_intents?select=entity_id,amount_btc` +
          `&entity_id=in.(${proposals.map(p => p.entityId).join(',')})` +
          `&status=in.(${SETTLED_INTENT_STATUSES})`
      );
      for (const i of intents) {
        fundedById.set(i.entity_id, (fundedById.get(i.entity_id) || 0) + Number(i.amount_btc || 0));
      }
    } catch (err) {
      console.error(`  ! funding lookup failed: ${err.message}`);
    }
  }

  const published = proposals.filter(p => statusById.get(p.entityId) === 'active').length;
  const funded = proposals.filter(p => (fundedById.get(p.entityId) || 0) > 0).length;
  const totalFundedBtc = [...fundedById.values()].reduce((a, b) => a + b, 0);

  const report = {
    windowDays: WINDOW_DAYS,
    since,
    proposed: proposals.length,
    published,
    funded,
    totalFundedBtc,
    publishRate: proposals.length ? +(published / proposals.length).toFixed(3) : null,
    fundRate: proposals.length ? +(funded / proposals.length).toFixed(3) : null,
    byAction: Object.fromEntries(
      Object.keys(CREATE_ACTION_TABLES)
        .map(a => [a, proposals.filter(p => p.actionId === a).length])
        .filter(([, n]) => n > 0)
    ),
  };

  console.log(`Cat outcome funnel (last ${WINDOW_DAYS}d):`);
  console.log(
    `  proposed ${report.proposed} → published ${report.published} → funded ${report.funded}` +
      (totalFundedBtc > 0 ? ` (${totalFundedBtc} BTC settled)` : '')
  );
  for (const [action, n] of Object.entries(report.byAction)) {
    console.log(`    ${action}: ${n}`);
  }

  if (JSON_OUT) {
    writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
    console.log(`  report → ${JSON_OUT}`);
  }

  // Dead-audit-trail gate — see gateVerdict for why it needs three inputs.
  if (GATE && report.proposed === 0) {
    const msgs = await rest(
      `cat_messages?select=id&role=eq.assistant&created_at=gte.${since}&limit=1`
    );
    // The rows the gate must look at are ALL of them, with no status or action
    // filter: "nothing is written at all" is the only shape that means the
    // write path is dead. Fetching this is the whole fix.
    const logAny = await rest(
      `cat_action_log?select=action_id,status&created_at=gte.${since}&order=created_at.desc&limit=200`
    );
    const verdict = gateVerdict({
      proposed: report.proposed,
      hasAssistantActivity: msgs.length > 0,
      logRows: logAny,
    });
    if (verdict.fail) {
      console.error(verdict.message);
      process.exit(1);
    }
    console.log(`  ${verdict.message}`);
  }
}

// Run only when executed directly. Importing this module (the unit test does)
// must not hit the network or exit the process — that is what kept the gate's
// own predicate untestable while it was wrong.
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  requireEnv();
  main().catch(err => {
    console.error(`eval-cat-outcomes: ${err.message}`);
    process.exit(2);
  });
}

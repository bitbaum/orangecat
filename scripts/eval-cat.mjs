#!/usr/bin/env node
/**
 * Cat judgment eval — nightly regression gate.
 *
 * Runs the 8 canonical entity-type probes (established in PR #375) against the
 * PRODUCTION Cat chat pipeline (`POST /api/cat/chat`, streaming SSE — the
 * non-streaming path 500s at ~38s on tool-heavy messages, a known box issue)
 * and scores every reply on three axes:
 *
 *   1. right entity type   — a prefill draft card (or, as fallback, the reply
 *                            text) proposes the expected entity type
 *   2. why-explanation     — the reply explains WHY that type fits
 *   3. no duplicate drafts — never two draft cards of the same type in one turn
 *
 * Exit codes: 0 = pass · 1 = regression (type <7/8 or why <7/8) · 2 = harness error.
 *
 * Hygiene (lessons from the PR #375 ad-hoc harness):
 *   - Every probe runs in its OWN dedicated, non-default conversation and all
 *     of them are DELETED afterwards (cat_messages + run-window cat_memories
 *     too), so the test user's conversation rail stays clean AND probes can't
 *     contaminate each other via shared history or per-user memory recall.
 *   - The test user's daily platform_api_usage row is cleared before AND
 *     after the run, so the free-tier cap neither blocks the eval nor is
 *     consumed by it.
 *
 * On failure with CAT_EVAL_NOTIFY=1 (set by the systemd unit on the box), an
 * in-app notification is UPSERTED for the founder via the same schema the
 * NotificationDispatcher uses (notifications: user_id, type, message,
 * metadata{title,...}, is_read) and the failure is logged to stderr (journal).
 * Upserted, not inserted: a repeated nightly failure updates the existing
 * UNREAD row for the same title (bumping metadata.occurrences) instead of
 * stacking a duplicate every night. The notification's action_url deep-links
 * into the Cat chat with a prepared question, so the founder's first stop is
 * the Cat (which can run a live provider health check), not journalctl.
 *
 * Env (all read from process.env, with .env.local as local-dev fallback):
 *   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL     GoTrue + PostgREST host
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY                   cleanup + cap reset + notify
 *   CAT_EVAL_BASE_URL      target app (default https://orangecat.ch)
 *   CAT_EVAL_PROVIDER      groq|openrouter (default: openrouter when
 *                           OPENROUTER_API_KEY is present, otherwise groq)
 *   CAT_EVAL_MODEL         pinned model (provider default unless overridden)
 *   CAT_EVAL_EMAIL         eval user (default the dedicated Lena test account)
 *   CAT_EVAL_PASSWORD      eval user password
 *   GROQ_API_KEY / OPENROUTER_API_KEY            optional; used only to choose
 *                           a default eval provider. The app serves the locked
 *                           request through its own platform provider config.
 *   CAT_EVAL_NOTIFY        "1" → notify founder in-app on failure
 *   CAT_EVAL_NOTIFY_USER_ID  recipient (default founder mao)
 *   CAT_EVAL_JSON_OUT      write full JSON report to this path
 *
 * Deploy path on the box: /opt/orangecat/scripts/eval-cat.mjs
 * (installed by scripts/deploy-selfhost.sh; run nightly by the
 *  orangecat-cat-eval.timer systemd unit at 04:30 UTC).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { signInWithPassword, buildAuthCookie } from './eval-auth.mjs';
import { readRateLimitHeaders } from './eval-rate-limit.mjs';

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

/** Minimal .env.local fallback for local runs (box uses EnvironmentFile). */
function loadLocalEnvFallback() {
  if (!existsSync('.env.local')) {return;}
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadLocalEnvFallback();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = process.env.CAT_EVAL_BASE_URL || 'https://orangecat.ch';
// Dedicated eval account (test fixture, not a human user).
const EVAL_EMAIL = process.env.CAT_EVAL_EMAIL || 'lena.brunner.test@proton.me';
const EVAL_PASSWORD = process.env.CAT_EVAL_PASSWORD || 'Ceramica2026!';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const EVAL_PROVIDER =
  process.env.CAT_EVAL_PROVIDER || (OPENROUTER_API_KEY ? 'openrouter' : 'groq');
// Pin one provider/model for repeatability: the gate measures the Cat judgment
// pipeline (rubric, tools, prefill, why-line), not whichever free-model fallback
// is least congested tonight.
// MUST equal DEFAULT_FREE_MODEL_ID in src/config/ai-models.ts. This script
// runs on the box, where only the standalone build ships (no src/), so it
// cannot import the registry at runtime — instead
// __tests__/unit/scripts/eval-cat-model.test.ts asserts the two match, and
// CI fails the moment they drift.
//
// The old literal
// 'openai/gpt-oss-120b:free' silently stopped being a free model — the
// registry now carries 'openai/gpt-oss-120b' as PAID and only the 20b variant
// as free — so every probe was rejected by OrangeCat's own paywall with
// HTTP 402 INSUFFICIENT_CREDITS, and the harness reported it as a
// "provider layer" failure — the gate had been dead since Cat Credits went
// live on 2026-08-01. Pinning the registry's default free model also means
// the eval measures the model users actually get.
const EVAL_MODEL =
  process.env.CAT_EVAL_MODEL ||
  (EVAL_PROVIDER === 'groq' ? 'llama-3.3-70b-versatile' : 'nvidia/nemotron-3-super-120b-a12b:free');
const NOTIFY = process.env.CAT_EVAL_NOTIFY === '1';
const NOTIFY_USER_ID =
  process.env.CAT_EVAL_NOTIFY_USER_ID || 'cec88bc9-557f-452b-92f1-e093092fecd6'; // founder mao
const JSON_OUT =
  process.env.CAT_EVAL_JSON_OUT ||
  (process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null);

const PROBE_TIMEOUT_MS = 120_000; // tool phase ≤25s + free-model generation
const INTER_PROBE_DELAY_MS = 8_000; // be gentle to free-tier TPM
const MAX_ATTEMPTS = 4; // per probe, on transient failures only
// The free pool's own message is "Free AI capacity is maxed out right now.
// Try again in a minute" — but the longest backoff was 45s, so retries gave
// up just before capacity came back. Observed live: probes a–f passed and
// g/h both exhausted their attempts inside ~65s. The final 90s step honours
// what the provider actually asks for.
const RETRY_BACKOFF_MS = [20_000, 45_000, 90_000];
const PASS_THRESHOLD = 7; // per axis, out of 8

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('eval-cat: missing SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY in env');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// The 8 canonical probes (PR #375)
// ---------------------------------------------------------------------------

const PROBES = [
  {
    id: 'a-haircuts',
    label: 'Haircuts at home → service',
    message: 'I offer haircuts at home in Zürich, 40 CHF per cut.',
    expect: { types: ['service'] },
  },
  {
    id: 'b-mugs',
    label: 'Handmade mugs → product',
    message: 'I hand-make ceramic mugs and want to sell them.',
    expect: { types: ['product'] },
  },
  {
    id: 'c-trees',
    label: 'Tree-planting fundraiser → cause/project',
    message:
      'I want to raise money to plant 1000 trees around my village next spring. People who chip in should see the progress.',
    expect: { types: ['cause', 'project'] },
  },
  {
    id: 'd-bike-loan',
    label: '500 CHF bike repair → loan',
    message:
      'I need 500 CHF to fix my bike so I can keep delivering food. I can pay it back from my delivery earnings within two months.',
    expect: { types: ['loan'] },
  },
  {
    id: 'e-linkedin-bio',
    label: 'LinkedIn-style bio → service + question',
    message:
      'Senior software engineer with 10 years in fintech. I design payment systems, lead teams of 5-10 engineers, and mentor juniors. Open to consulting engagements.',
    expect: { types: ['service'], question: true },
  },
  {
    id: 'f-meetup',
    label: 'Bitcoin meetup Basel → event',
    message: "I'm organizing a Bitcoin meetup next month in Basel.",
    expect: { types: ['event'] },
  },
  {
    id: 'g-bakery',
    label: 'Bare "we\'re a bakery" → clarifying question',
    message: "we're a bakery",
    expect: { question: true },
  },
  {
    id: 'h-charter',
    label: 'Community charter → group first',
    message:
      "A few of us have been meeting weekly as the Philosopher's Stone circle. We wrote a shared charter of values, and now we want to formalize our community, pool a small treasury, and eventually fund projects our members propose.",
    expect: { types: ['group', 'circle'], groupFirst: true },
  },
];

// ---------------------------------------------------------------------------
// Supabase REST helpers (service role)
// ---------------------------------------------------------------------------

const svcHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// PostgREST reloads its schema cache in the background; while that is in flight
// it answers 503 PGRST002 ("Could not query the database for the schema cache.
// Retrying.") — a state that clears itself in seconds. With no retry, one such
// blip anywhere in the run kills the whole nightly gate: 2026-08-04 the eval
// died in resetDailyCap on exactly this, so a self-healing hiccup read as a
// failed judgment gate. Transport errors (fetch throws) are the same class.
// 4xx is a real verdict about the request and is never retried.
const REST_RETRIES = 4;
const REST_BACKOFF_MS = 1500;

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
      await sleepBackoff(attempt, 'transport');
      continue;
    }
    if (res.ok) {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    }
    const detail = await res.text();
    lastErr = new Error(`PostgREST ${method} ${path} → ${res.status}: ${detail}`);
    if (res.status < 500) {throw lastErr;}
    await sleepBackoff(attempt, `${res.status}`);
  }
  throw lastErr;
}

// `why` only ever carries an HTTP status or the literal 'transport' — never the
// request path. A PostgREST path puts its filters in the query string
// (?user_id=eq.<uuid>) and those ids come from env, so logging it would write
// identifiers into the journal for no diagnostic gain. The error thrown once the
// retries are exhausted still names the full path for whoever is debugging.
async function sleepBackoff(attempt, why) {
  if (attempt >= REST_RETRIES) {return;}
  const wait = REST_BACKOFF_MS * attempt;
  console.warn(`eval-cat: PostgREST transient (${why}) — retry ${attempt}/${REST_RETRIES - 1} in ${wait}ms`);
  await new Promise((r) => setTimeout(r, wait));
}

// ---------------------------------------------------------------------------
// SSE probe runner
// ---------------------------------------------------------------------------

async function runProbe(probe, cookie, conversationId) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const out = { content: '', proposals: [], toolCalls: 0, model: null, error: null, done: false };

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
      return { ...out, ms: Date.now() - started };
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
        if (!dataLine) {continue;}
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
        if (typeof payload.content === 'string') {out.content += payload.content;}
        if (payload.prefill_proposal) {out.proposals.push(payload.prefill_proposal);}
        if (payload.tool_call) {out.toolCalls++;}
        if (payload.model) {out.model = payload.model;}
        if (payload.done) {out.done = true;}
      }
    }
  } catch (err) {
    out.error = err.name === 'AbortError' ? `timeout after ${PROBE_TIMEOUT_MS}ms` : String(err);
  } finally {
    clearTimeout(timer);
  }
  return { ...out, ms: Date.now() - started };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Does this run pass?
 *
 * `type` always gates: it checks STRUCTURE — which draft card was attached,
 * whether a clarifying question was asked — and a regex can check structure
 * honestly.
 *
 * `why` gates only when something can actually judge MEANING. Its detector is
 * a list of fifteen English connectives, so a reply that reasons in other
 * words scores zero, and gating on it pages the founder for answers that are
 * fine. A gate that cries wolf is worse than no gate. Switch on the semantic
 * judge (CAT_EVAL_JUDGE=1) and `why` becomes a real gate again.
 */
export function computePass(scores, { judgeWhy = false, threshold = 7 } = {}) {
  if (scores.type < threshold) {
    return false;
  }
  return judgeWhy ? scores.why >= threshold : true;
}

function scoreProbe(probe, result) {
  const { expect } = probe;
  const proposalTypes = result.proposals.map(p => p.entityType);
  const content = result.content || '';

  // --- right entity type -------------------------------------------------
  let typeOk;
  if (expect.types) {
    const cardHit = proposalTypes.some(t => expect.types.includes(t));
    // Fallback for known free-model variance: the reply recommends the type
    // in prose without attaching the draft card (PR #375, probe c).
    const proseHit = expect.types.some(t => new RegExp(`\\b${t}\\b`, 'i').test(content));
    typeOk = cardHit || proseHit;
    if (expect.groupFirst) {
      // Group must lead: first card is group/circle, or (no cards) the prose
      // mentions group/circle before any project/product pitch.
      const firstCardOk = proposalTypes.length
        ? ['group', 'circle'].includes(proposalTypes[0])
        : null;
      const groupIdx = content.toLowerCase().search(/\bgroup\b|\bcircle\b/);
      const projIdx = content.toLowerCase().search(/\bproject\b|\bproduct\b/);
      const proseFirstOk = groupIdx !== -1 && (projIdx === -1 || groupIdx < projIdx);
      typeOk = firstCardOk !== null ? firstCardOk : proseFirstOk;
    }
  } else {
    // Thin input: pass = Cat interviews (asks a focused question) instead of
    // committing to an arbitrary draft.
    typeOk = /\?/.test(content);
  }

  // --- why-explanation present -------------------------------------------
  // A PHRASE LIST, and it must be read as one. This asks "did Cat use one of
  // fifteen English connectives", which is not the same question as "did Cat
  // explain itself" — and the difference is not hypothetical. On 2026-09-12
  // the g-bakery probe answered "As a bakery, you already have the asset and
  // the skill to turn your craft into income", which IS a reason, matched
  // nothing here, and paged the founder as a REGRESSION.
  //
  // A gate that cries wolf is worse than no gate: it teaches everyone to
  // ignore the one alarm that might be real. So this score is advisory unless
  // a semantic judge is switched on (CAT_EVAL_JUDGE=1) — see PASS below.
  const whyOk =
    /\bbecause\b|\bwhy (a|an|this|it)\b|\bfits\b|\bmatches\b|rather than|instead of|that way|perfect (for|if)|ideal (for|if)|best way|simple way|great way|lets (you|people)|so (you|people|supporters|members) can/i.test(
      content
    );

  // --- follow-up question when expected ----------------------------------
  const questionOk = expect.question ? /\?/.test(content) : true;

  // --- duplicate draft cards ----------------------------------------------
  const dup = proposalTypes.length !== new Set(proposalTypes).size;

  return {
    typeOk: Boolean(typeOk && questionOk),
    whyOk,
    dup,
    proposalTypes,
  };
}

// ---------------------------------------------------------------------------
// Hygiene: dedicated conversation + cap reset + cleanup
// ---------------------------------------------------------------------------

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

async function resetDailyCap(userId) {
  await rest(
    'DELETE',
    `platform_api_usage?user_id=eq.${userId}&usage_date=eq.${todayUTC()}`,
    { prefer: 'return=minimal' }
  );
}

async function createEvalConversation(userId, probeId) {
  const rows = await rest('POST', 'cat_conversations', {
    body: { user_id: userId, title: `[eval] ${probeId}`, is_default: false },
    prefer: 'return=representation',
  });
  return rows[0].id;
}

/**
 * Cat memories are recalled per USER (not per conversation), so facts
 * extracted from one probe would leak into the next even across separate
 * conversations — the exact contamination PR #375 flagged. Best-effort purge
 * of everything extracted since the run started, between probes and at the
 * end (extraction is detached server-side, so a late row can slip past an
 * intermediate purge; the final purge catches it).
 */
async function purgeRunMemories(userId, sinceIso) {
  await rest(
    'DELETE',
    `cat_memories?user_id=eq.${userId}&created_at=gte.${encodeURIComponent(sinceIso)}`,
    { prefer: 'return=minimal' }
  );
}

/**
 * Delete eval conversations left behind by an EARLIER run. End-of-run cleanup
 * only knows the ids it collected in memory, so a hard kill (CI timeout, box
 * restart) between probes strands them forever: 18 such rows from a single
 * 2026-07-03 run were still sitting in production a month later, making up
 * more than a third of the whole conversations table and inflating every
 * usage metric read off it. Sweeping by title at START is the durable fix —
 * it needs no memory of the run that leaked.
 */
async function sweepStaleEvalConversations(userId) {
  const stale = await rest(
    'GET',
    `cat_conversations?user_id=eq.${userId}&is_default=is.false&title=like.${encodeURIComponent('[eval]%')}&select=id`
  );
  for (const { id } of stale ?? []) {
    await rest('DELETE', `cat_messages?conversation_id=eq.${id}`, { prefer: 'return=minimal' });
    await rest('DELETE', `cat_conversations?id=eq.${id}`, { prefer: 'return=minimal' });
  }
  if (stale?.length) {
    console.error(`eval-cat: swept ${stale.length} stale eval conversation(s) from a previous run`);
  }
}

async function cleanupEvalArtifacts(userId, conversationIds, runStartIso) {
  await purgeRunMemories(userId, runStartIso);
  for (const id of conversationIds) {
    await rest('DELETE', `cat_messages?conversation_id=eq.${id}`, { prefer: 'return=minimal' });
    await rest('DELETE', `cat_conversations?id=eq.${id}&is_default=is.false`, {
      prefer: 'return=minimal',
    });
  }
  // Give the eval user their full daily cap back.
  await resetDailyCap(userId);
}

// ---------------------------------------------------------------------------
// Failure notification (mirrors NotificationDispatcher.createInAppNotification)
// ---------------------------------------------------------------------------

/**
 * Insert-or-update the founder's in-app alert for one failure class (keyed by
 * metadata title). Coalescing rule: if an UNREAD notification with the same
 * title from this script already exists, update it in place and bump
 * metadata.occurrences — never stack a duplicate row per night. action_url
 * opens the Cat chat with a prepared question so the Cat (which can run live
 * provider health probes) does the triage.
 */
async function upsertFounderNotification(title, message, extraMetadata = {}) {
  const question = `Help me with this notification: ${title} — "${message}" What does it mean and what should I do?`;
  const actionUrl = `/dashboard/cat?q=${encodeURIComponent(question)}`;
  const existing = await rest(
    'GET',
    `notifications?user_id=eq.${NOTIFY_USER_ID}&type=eq.system&is_read=eq.false` +
      `&metadata->>source=eq.eval-cat.mjs&metadata->>title=eq.${encodeURIComponent(title)}` +
      `&select=id,metadata&order=created_at.desc&limit=1`
  );
  const baseMetadata = {
    ...extraMetadata,
    title,
    source: 'eval-cat.mjs',
    ranAt: new Date().toISOString(),
  };
  if (Array.isArray(existing) && existing.length > 0) {
    const prev = existing[0];
    const occurrences = (Number(prev.metadata?.occurrences) || 1) + 1;
    await rest('PATCH', `notifications?id=eq.${prev.id}`, {
      body: { message, action_url: actionUrl, metadata: { ...baseMetadata, occurrences } },
      prefer: 'return=minimal',
    });
    return;
  }
  await rest('POST', 'notifications', {
    body: {
      user_id: NOTIFY_USER_ID,
      type: 'system',
      message,
      action_url: actionUrl,
      metadata: { ...baseMetadata, occurrences: 1 },
      is_read: false,
    },
    prefer: 'return=minimal',
  });
}

async function notifyFounder(summaryLine, report) {
  await upsertFounderNotification(
    'Cat eval regression',
    `Nightly Cat eval FAILED — ${summaryLine}. Tap to have your Cat look into it.`,
    {
      typeScore: report.scores.type,
      whyScore: report.scores.why,
      duplicateDrafts: report.scores.duplicates,
      failedProbes: report.probes.filter(p => !p.typeOk || !p.whyOk).map(p => p.id),
    }
  );
}

async function notifyFounderHarnessError(summaryLine) {
  await upsertFounderNotification(
    'Cat eval harness error',
    `Nightly Cat eval could not complete — ${summaryLine}. Tap to have your Cat diagnose the providers.`
  );
}

/**
 * A SKIP is a third state, and it used to reach nobody.
 *
 * Standing down to protect the user-facing free pool is correct behaviour, so
 * it must not page like a regression. But it returned with exit 0, systemd
 * recorded success, and the night looked identical to a night where Cat was
 * verified and healthy. It skipped silently on 2026-09-10 and 2026-09-11; the
 * only reason anyone found out was reading the journal by hand.
 *
 * Silence is the failure. An unread day gets said out loud, once — the
 * notification is UPSERTED on its title like every other, so a run of skipped
 * nights bumps one row rather than stacking a pile nobody reads either.
 */
async function notifyFounderSkipped(reason) {
  await upsertFounderNotification(
    'Cat eval did not run',
    `Nightly Cat eval stood down — ${reason} Cat is UNVERIFIED for this night, which is not the same as healthy.`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const sleep = ms => new Promise(r => setTimeout(r, ms));


// ---------------------------------------------------------------------------
// Free-tier budget guard
// ---------------------------------------------------------------------------

/**
 * The eval and real users drink from the same 50-requests/day free pool, and
 * the eval is the only one of the two that can wait. Eight probes is 16% of
 * the day's capacity; with retries it has reached a third of it. On 2026-08-06
 * the pool was fully exhausted and a real user asking Cat a question got
 * "Free AI capacity is maxed out right now" — diagnostics must never be the
 * reason that happens.
 *
 * So: check what's left before starting, and stand down if running would eat
 * into the reserve kept for people. Costs one request to learn the number,
 * which is cheaper than discovering it eight failures in.
 */
const FREE_TIER_RESERVE = Number(process.env.CAT_EVAL_FREE_RESERVE || 20);

/**
 * Judge the "why" axis by MEANING rather than by phrasing.
 *
 * Off by default, and the reason is budget rather than doubt: the eval already
 * stands down on most nights because eight probes plus a 20-request reserve
 * does not fit in 50 free requests a day, and judging adds calls to exactly
 * the pool that is already short. Built now, switched on with one env var the
 * day the ceiling is raised — at which point `why` becomes a real gate again.
 */
const JUDGE_WHY = process.env.CAT_EVAL_JUDGE === '1';

async function freeModelBudget() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {return null;}
  // Header parsing lives in eval-rate-limit.mjs, and is tested there: the
  // inline version read a MISSING header as 0 remaining and skipped the eval
  // every night from 2026-09-10 while the free model was answering fine.
  const read = readRateLimitHeaders;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EVAL_MODEL.includes(':free') ? EVAL_MODEL : 'nvidia/nemotron-3-super-120b-a12b:free',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    });
    return read(res.headers);
  } catch {
    // Unknown is not the same as empty — let the run proceed rather than
    // silently skipping the eval forever on a transient network blip.
    return null;
  }
}

async function main() {
  console.error(
    `eval-cat: target=${BASE_URL} user=${EVAL_EMAIL} provider=${EVAL_PROVIDER} model=${EVAL_MODEL}`
  );
  const budget = await freeModelBudget();
  if (!budget) {
    console.error('eval-cat: free-model budget unknown (no rate-limit headers) — proceeding');
  }
  if (budget) {
    console.error(
      `eval-cat: free-model budget ${budget.remaining}/${budget.limit ?? '?'} remaining (reserve ${FREE_TIER_RESERVE})`
    );
    if (budget.remaining < FREE_TIER_RESERVE + PROBES.length) {
      const reason =
        `running ${PROBES.length} probes would have left real users under the ` +
        `${FREE_TIER_RESERVE}-request reserve (budget was ${budget.remaining}/${budget.limit ?? '?'}). ` +
        `Resets at ${budget.reset ? new Date(budget.reset).toISOString() : 'unknown'}. ` +
        'Raise the ceiling permanently with 10 OpenRouter credits (50/day -> 1000/day).';
      console.error(`eval-cat: SKIPPED — ${reason}`);
      // Exit 0 on purpose: standing down is correct, not a failure, and
      // paging nightly for a budget ceiling would train everyone to ignore
      // this unit. But it must not be SILENT — see notifyFounderSkipped.
      if (NOTIFY) {
        try {
          await notifyFounderSkipped(reason);
          console.error(`eval-cat: founder notified that the eval did not run (${NOTIFY_USER_ID})`);
        } catch (err) {
          console.error(`eval-cat: failed to insert skip notification: ${err}`);
        }
      }
      return;
    }
  }

  const session = await signInWithPassword({
    supabaseUrl: SUPABASE_URL,
    anonKey: ANON_KEY,
    email: EVAL_EMAIL,
    password: EVAL_PASSWORD,
  });
  const userId = session.user.id;
  const cookie = buildAuthCookie(SUPABASE_URL, session);

  await resetDailyCap(userId);
  await sweepStaleEvalConversations(userId).catch(err =>
    console.error(`eval-cat: stale-conversation sweep failed (non-fatal): ${err}`)
  );

  const runStartIso = new Date().toISOString();
  const report = {
    timestamp: runStartIso,
    baseUrl: BASE_URL,
    probes: [],
    scores: { type: 0, why: 0, duplicates: 0, max: PROBES.length },
  };
  const conversationIds = [];

  try {
    for (const probe of PROBES) {
      // One fresh conversation PER probe: shared history made the model
      // answer a previous unanswered probe instead of the current one
      // (observed live: an empty-reply turn shifted every later reply one
      // probe back). Isolation keeps each score about its own input.
      const conversationId = await createEvalConversation(userId, probe.id);
      conversationIds.push(conversationId);
      console.error(`eval-cat: probe ${probe.id} (conversation ${conversationId}) …`);

      // Retry with real backoff on TRANSIENT failures (free-tier provider
      // 429s, transport errors, empty/fallback replies) — those measure
      // provider capacity, not Cat's judgment. Genuine replies are never
      // re-rolled: first real answer is the scored answer.
      const isTransient = r =>
        Boolean(r.error) ||
        (r.proposals.length === 0 &&
          (!r.content.trim() || r.content.startsWith("I couldn't put together a reply")));
      let result;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (attempt > 0) {
          console.error(
            `eval-cat:   retry ${attempt}/${MAX_ATTEMPTS - 1} for ${probe.id} (${result.error || 'empty reply'})`
          );
          await sleep(RETRY_BACKOFF_MS[attempt - 1]);
        }
        result = await runProbe(probe, cookie, conversationId);
        result.retried = attempt > 0;
        if (!isTransient(result)) {break;}
      }

      const score = scoreProbe(probe, result);
      report.probes.push({
        id: probe.id,
        label: probe.label,
        ...score,
        model: result.model,
        ms: result.ms,
        retried: Boolean(result.retried),
        error: result.error,
        contentSnippet: (result.content || '').slice(0, 220),
      });
      if (score.typeOk) {report.scores.type++;}
      if (score.whyOk) {report.scores.why++;}
      if (score.dup) {report.scores.duplicates++;}

      // Purge memories extracted from this probe so they can't contaminate
      // the next one (recall is per-user, not per-conversation).
      await purgeRunMemories(userId, runStartIso).catch(() => {});
      await sleep(INTER_PROBE_DELAY_MS);
    }
  } finally {
    try {
      await cleanupEvalArtifacts(userId, conversationIds, runStartIso);
      console.error('eval-cat: cleanup done (conversations, messages, memories, daily cap)');
    } catch (err) {
      console.error(`eval-cat: CLEANUP FAILED — manual sweep needed: ${err}`);
    }
  }

  // ---- report ------------------------------------------------------------
  const { scores } = report;
  const providerErrorCount = report.probes.filter(p => Boolean(p.error)).length;
  const pass = computePass(scores, { judgeWhy: JUDGE_WHY, threshold: PASS_THRESHOLD });
  const summaryLine = `type ${scores.type}/${scores.max} · why ${scores.why}/${scores.max} · duplicate-draft probes ${scores.duplicates}`;

  console.log('');
  console.log('=== Cat eval — nightly judgment gate ===');
  for (const p of report.probes) {
    const flags = [
      p.typeOk ? 'type✓' : 'type✗',
      p.whyOk ? 'why✓' : 'why✗',
      p.dup ? 'DUP' : '',
      p.error ? `err(${p.error.slice(0, 60)})` : '',
    ]
      .filter(Boolean)
      .join(' ');
    console.log(
      `  ${p.typeOk && p.whyOk && !p.dup ? 'PASS' : 'FAIL'}  ${p.id.padEnd(15)} ${flags}  [${p.proposalTypes.join(',') || 'no card'}] ${(p.ms / 1000).toFixed(1)}s`
    );
  }
  console.log(`  → ${summaryLine} — ${pass ? 'PASS' : 'FAIL'}`);
  if (!JUDGE_WHY) {
    console.log(
      `  → note: "why" is ADVISORY (${scores.why}/${scores.max}). It matches a fixed list of ` +
        'English connectives, so a reply that reasons in other words scores zero. ' +
        'Set CAT_EVAL_JUDGE=1 (needs OPENROUTER_API_KEY) to judge it semantically and gate on it.'
    );
  }
  console.log(JSON.stringify(report, null, 2));
  if (JSON_OUT) {writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));}

  if (providerErrorCount > 0) {
    const line = `${providerErrorCount}/${scores.max} probe(s) failed at the provider layer; judgment score is invalid`;
    console.error(`eval-cat: HARNESS ERROR — ${line}`);
    if (NOTIFY) {
      try {
        await notifyFounderHarnessError(line);
        console.error(`eval-cat: founder notified in-app (${NOTIFY_USER_ID})`);
      } catch (err) {
        console.error(`eval-cat: failed to insert founder notification: ${err}`);
      }
    }
    process.exit(2);
  }

  if (!pass) {
    console.error(`eval-cat: REGRESSION — ${summaryLine}`);
    if (NOTIFY) {
      try {
        await notifyFounder(summaryLine, report);
        console.error(`eval-cat: founder notified in-app (${NOTIFY_USER_ID})`);
      } catch (err) {
        console.error(`eval-cat: failed to insert founder notification: ${err}`);
      }
    }
    process.exit(1);
  }
}

// Exported so the retry contract can be tested (see
// __tests__/unit/scripts/eval-cat-retry.test.ts). Importing this module must
// therefore NOT start a run — hence the direct-invocation guard below.
export { rest, scoreProbe };

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {main().catch(async err => {
  console.error(`eval-cat: harness error: ${err?.stack || err}`);
  if (NOTIFY) {
    try {
      await upsertFounderNotification(
        'Cat eval harness error',
        `Nightly Cat eval could not run: ${String(err).slice(0, 200)}`
      );
    } catch {
      /* journal already has the primary error */
    }
  }
  process.exit(2);
});}

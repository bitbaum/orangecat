#!/usr/bin/env node
/**
 * Nightly DATA-INVARIANT gate — assert against the rows production actually
 * holds, not the rows the unit tests imagine.
 *
 * Every test in this repo runs against mocks. That is why the shared-wallet
 * disclosure shipped wrong three times on 2026-08-02 with a fully green suite:
 * the mocks encoded the data shape we assumed (one address per wallet row,
 * links that point at live entities), and production held a different one
 * (the same address across 2–11 wallet rows, 8 of 10 links pointing at deleted
 * entities). No amount of unit testing finds that class — only reading prod
 * does. This runs the reading on a schedule.
 *
 * Each invariant is a claim the product makes to users. A violation means we
 * are showing someone something false about their money.
 *
 * Usage:
 *   node scripts/check-data-invariants.mjs           # report, always exit 0
 *   node scripts/check-data-invariants.mjs --gate    # exit 1 on any violation
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * (.env.local fallback for local runs, EnvironmentFile on the box).
 */

import { readFileSync, existsSync } from 'node:fs';

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
const GATE = process.argv.includes('--gate');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('check-data-invariants: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

async function rest(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`PostgREST ${res.status} on ${path.split('?')[0]}: ${await res.text()}`);
  }
  return res.json();
}

/** PostgREST RPC (POST). `rest` only does GET; functions need a body. */
async function rpc(fn, body = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`PostgREST ${res.status} on rpc/${fn}: ${await res.text()}`);
  }
  return res.json();
}

/**
 * entity_type → table. MUST mirror src/config/entity-registry.ts; a type
 * missing here is reported as UNKNOWN rather than silently passing, so a new
 * entity type cannot quietly opt out of the orphan check.
 */
const ENTITY_TABLES = {
  product: 'user_products',
  service: 'user_services',
  project: 'projects',
  cause: 'user_causes',
  event: 'events',
  asset: 'assets',
  loan: 'loans',
  investment: 'investments',
  ai_assistant: 'ai_assistants',
  research: 'research_projects',
  wishlist: 'wishlists',
  document: 'documents',
  group: 'groups',
  circle: 'circles',
};

const violations = [];
const notes = [];

function violation(name, detail, sample) {
  violations.push({ name, detail, sample });
}

/**
 * Orphaned wallet links. entity_wallets is polymorphic, so Postgres cannot
 * cascade it — links outlive their entity unless the delete path removes them.
 * These rows made the shared-wallet disclosure count pages that do not exist.
 */
async function checkOrphanedWalletLinks() {
  const links = await rest('entity_wallets?select=id,entity_type,entity_id');
  const byType = new Map();
  for (const l of links) {
    byType.set(l.entity_type, [...(byType.get(l.entity_type) ?? []), l]);
  }

  const orphans = [];
  for (const [type, rows] of byType) {
    const table = ENTITY_TABLES[type];
    if (!table) {
      violation(
        'entity_wallets.unknown_entity_type',
        `entity_wallets holds type "${type}" with no table mapping — add it to ENTITY_TABLES (and check the entity registry)`,
        rows.slice(0, 3).map(r => r.entity_id)
      );
      continue;
    }
    const ids = rows.map(r => r.entity_id);
    const found = await rest(`${table}?select=id&id=in.(${ids.join(',')})`);
    const live = new Set(found.map(f => f.id));
    orphans.push(...rows.filter(r => !live.has(r.entity_id)));
  }

  if (orphans.length > 0) {
    violation(
      'entity_wallets.orphaned_links',
      `${orphans.length} wallet link(s) point at entities that no longer exist — the delete path is leaking again`,
      orphans.slice(0, 5).map(o => `${o.entity_type}:${o.entity_id}`)
    );
  } else {
    notes.push(`entity_wallets: ${links.length} link(s), all pointing at live entities`);
  }
}

/**
 * Two links flagged is_primary for the SAME entity. resolveLinkedEntityWallet
 * orders by is_primary with no tiebreaker, so which wallet receives the next
 * payment becomes nondeterministic — money routed by row order.
 */
async function checkDuplicatePrimaryLinks() {
  const links = await rest('entity_wallets?select=entity_type,entity_id,is_primary&is_primary=is.true');
  const seen = new Map();
  const dupes = [];
  for (const l of links) {
    const key = `${l.entity_type}:${l.entity_id}`;
    if (seen.has(key)) {
      dupes.push(key);
    }
    seen.set(key, true);
  }
  if (dupes.length > 0) {
    violation(
      'entity_wallets.duplicate_primary',
      `${dupes.length} entity/entities have more than one primary wallet link — payment routing is nondeterministic`,
      [...new Set(dupes)].slice(0, 5)
    );
  } else {
    notes.push(`entity_wallets: no entity has competing primary links`);
  }
}

/**
 * A wallet that can never receive: active, but holds neither a lightning
 * address, nor an on-chain address/xpub, nor an NWC connection. The UI can
 * still offer it, and resolution will silently skip to something else.
 */
async function checkUnpayableActiveWallets() {
  const wallets = await rest(
    'wallets?select=id,label,is_active,lightning_address,address_or_xpub,nwc_connection_uri&is_active=is.true'
  );
  const unpayable = wallets.filter(
    w => !w.lightning_address && !w.address_or_xpub && !w.nwc_connection_uri
  );
  if (unpayable.length > 0) {
    violation(
      'wallets.active_but_unpayable',
      `${unpayable.length} active wallet(s) have no lightning address, no on-chain address/xpub and no NWC connection`,
      unpayable.slice(0, 5).map(w => `${w.id} (${w.label ?? 'unlabelled'})`)
    );
  } else {
    notes.push(`wallets: all ${wallets.length} active wallet(s) have a usable receiving rail`);
  }
}

/**
 * Money-state divergence: an intent marked paid with no paid_at timestamp.
 * The settlement transition sets both together, so a mismatch means something
 * wrote the status outside claimPaidTransition.
 */
async function checkPaidWithoutTimestamp() {
  const rows = await rest('payment_intents?select=id,status,paid_at&status=eq.paid&paid_at=is.null');
  if (rows.length > 0) {
    violation(
      'payment_intents.paid_without_timestamp',
      `${rows.length} intent(s) are status=paid with paid_at NULL — status was set outside the settlement transition`,
      rows.slice(0, 5).map(r => r.id)
    );
  } else {
    notes.push('payment_intents: every paid intent carries a settlement timestamp');
  }
}

/**
 * A Cat send that stored nothing.
 *
 * A DEFAULT conversation is created in exactly one place — chat-prepare, while
 * serving a send — so a default conversation with zero messages means a request
 * reached the server and the user's message was never written. That was a real
 * bug until 2026-08-06: the streaming path saved a turn only `if (fullContent)`,
 * so a total provider-chain failure discarded the exchange. Six real accounts
 * are still frozen in that state from June 2026, each having tried Cat once.
 *
 * It went unnoticed for two months because the leftover row is indistinguishable
 * from "opened the page and never typed" — the failure erased its own evidence
 * and then counted as engagement. Hence a scheduled check rather than a test.
 *
 * Scoped to 30 days so the historical rows stay as evidence (they are the only
 * trace of those six attempts) without permanently reddening the gate. Empty
 * NON-default conversations are legitimate: the rail's "new chat" button makes
 * one before anything is typed.
 */
async function checkSilentlyDroppedCatTurns() {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const convs = await rest(
    `cat_conversations?select=id,user_id,created_at&is_default=eq.true&created_at=gte.${since}`
  );
  if (convs.length === 0) {
    notes.push('cat_conversations: no default conversations created in the last 30 days');
    return;
  }

  const ids = convs.map(c => c.id);
  const msgs = await rest(`cat_messages?select=conversation_id&conversation_id=in.(${ids.join(',')})`);
  const answered = new Set(msgs.map(m => m.conversation_id));
  const dropped = convs.filter(c => !answered.has(c.id));

  if (dropped.length > 0) {
    violation(
      'cat_conversations.send_stored_nothing',
      `${dropped.length} default conversation(s) hold zero messages — a send reached the server and the user's message was not persisted`,
      dropped.slice(0, 5).map(c => c.id)
    );
  } else {
    notes.push(`cat_conversations: all ${convs.length} recent send(s) stored their turn`);
  }
}

/**
 * Profiles whose auth user is gone.
 *
 * public.profiles carried NO foreign key until 2026-08-06, so deleting a user
 * left the profile standing: a public page and a taken username for an account
 * that no longer exists, and a row counted by every signup metric. That is how
 * 73% of production profiles came to be `e2e-reset-*` CI fixtures while the
 * real number (39) stayed invisible — the platform could not see its own users.
 *
 * The migration's ON DELETE CASCADE makes new orphans impossible. This check is
 * the backstop that notices if the constraint is ever dropped, bypassed, or
 * left NOT VALID while a delete path writes around it — and it is the reason
 * the count is worth watching rather than assuming.
 *
 * auth.users is not exposed through PostgREST, so this goes through the
 * service_role-only count_orphaned_profiles() function.
 */
/**
 * How many profiles still publish their email local part as a public handle.
 *
 * `/profiles/<username>` is served with no auth and robots.txt has no
 * /profiles rule, so such a handle is crawlable; with a handful of common
 * domains it reconstructs the address. handle_new_user() minted them until
 * 20260826130000.
 *
 * A RATCHET, not a zero-check. The 72 accounts that already have one are NOT
 * renamed: a username is also a Lightning address
 * (`<username>@orangecat.ch`) and a public profile URL, so renaming breaks
 * saved payment addresses and inbound links for real people. A gate demanding
 * zero would therefore be red every night about code that is fine — the exact
 * habit that teaches everyone to ignore the gate. This fails only if the
 * number RISES, which means a new write path started deriving handles from
 * emails again.
 */
// Zero, and it stays zero.
//
// This started as a ratchet against a live population: 77 profiles published
// their owner's email local part as a public, crawlable handle, and they could
// not simply be renamed because a username here is also a Lightning address.
// scripts/rename-email-derived-usernames.sql retired all of them on
// 2026-08-26 behind profile_username_history, so the old handles still resolve
// and the count is genuinely 0 — verified against production, along with 0
// display names still set to an email local part.
//
// A violation now means a write path started minting them again. There are
// three that used to: the handle_new_user trigger, ensureProfile(), and two
// profile form pre-fills. Each is covered by a test, so a regression here means
// a FOURTH one was added.
//
// System accounts (RFC 2606 `.invalid` addresses) are excluded from the count
// as of 20260828070000. They matched the predicate perfectly while leaking
// nothing — an undeliverable address has no mailbox, so no owner, so no
// personal information in its local part — and the retirement that predicate
// authorised took `@cat` off the platform for two days. See checkCatHandle.
const EMAIL_DERIVED_USERNAME_BASELINE = 0;

async function checkEmailDerivedUsernames() {
  const count = Number(await rpc('count_email_derived_usernames'));

  if (count > EMAIL_DERIVED_USERNAME_BASELINE) {
    violation(
      'profiles.username_from_email',
      `${count} profile(s) publish their email local part as a public, crawlable handle. ` +
        `All of them were retired on 2026-08-26 and every known write path is covered by a ` +
        `test, so this means a NEW one is minting them — find it before the count grows, and ` +
        `retire these with scripts/rename-email-derived-usernames.sql`,
      []
    );
  } else {
    notes.push('profiles: no handle is an email local part');
  }
}

// The same leak, one column over.
//
// The 2026-08-26 sweep cleared display names that were the email local part for
// exactly this reason, and nothing watched the column afterwards. That gap
// mattered the moment 20260907090000 added a write path setting `name` from
// OAuth metadata: some providers put the address itself in that field, so a
// repair for one leak is a plausible route back in for the other. The migration
// guards it at write time; this is the gate behind the guard.
const EMAIL_DERIVED_NAME_BASELINE = 0;

async function checkEmailDerivedNames() {
  const count = Number(await rpc('count_email_derived_names'));

  if (count > EMAIL_DERIVED_NAME_BASELINE) {
    violation(
      'profiles.name_from_email',
      `${count} profile(s) publish their email local part as a display NAME. A name is as ` +
        `public as a handle — it renders in every thread, mention and profile card — so this ` +
        `is the leak count_email_derived_usernames() watches, one column over. Find the write ` +
        `path that set it before the count grows.`,
      []
    );
  } else {
    notes.push('profiles: no display name is an email local part');
  }
}

/**
 * `@cat` must point at the Cat.
 *
 * This exists because on 2026-08-26 it stopped, and nothing anywhere noticed
 * for two days. The email-derived-handle retirement renamed the Cat from `cat`
 * to `user_0234d5e38e66` — correctly, by its own predicate, since the Cat's
 * handle IS derived from `cat@orangecat.invalid`. Every `@cat` on the platform
 * then resolved to nobody: no reply in any message, none under any post. The
 * profile still existed, /profiles/cat still 301'd through the history table,
 * CI was green and health was 200. The only observable symptom was silence,
 * from a feature whose whole job is to answer.
 *
 * So this checks the product claim rather than a schema fact: not "the Cat
 * account exists" — it did throughout — but "the name the platform tells people
 * to type reaches it". Those came apart, which is the entire lesson.
 *
 * Reads by handle deliberately. The resolver looks mentions up by username, so
 * this asks the question in the same terms the resolver does, and a lookup by
 * id would pass while `@cat` stayed broken.
 */
async function checkCatHandle() {
  // Kept in step with src/config/cat-identity.ts by
  // __tests__/unit/services/cat-handle-invariant.test.ts, which fails if the
  // handle there ever changes without this literal changing with it.
  const CAT_HANDLE = 'cat';
  const rows = await rest(`profiles?select=id,email&username=eq.${CAT_HANDLE}`);

  if (rows.length === 0) {
    violation(
      'cat.handle_resolves',
      `no profile answers to @${CAT_HANDLE}, so every @${CAT_HANDLE} in a message or under a ` +
        `post resolves to nobody and the Cat replies to nothing. The account itself may be ` +
        `perfectly healthy — check whether something renamed it (the handle-retirement script ` +
        `did exactly this once), then let the worker re-assert it via ensureCatAccount`,
      []
    );
    return;
  }

  // A handle held by the WRONG account is impersonation of the platform's own
  // agent, and that is worth naming separately from "missing".
  const holder = rows[0];
  if (!String(holder.email ?? '').endsWith('.invalid')) {
    violation(
      'cat.handle_resolves',
      `@${CAT_HANDLE} is held by an account with a deliverable email address, which means it is ` +
        `not the platform's agent — somebody is receiving every mention meant for the Cat`,
      [holder.id]
    );
    return;
  }

  notes.push(`cat: @${CAT_HANDLE} resolves to the Cat`);
}

/**
 * Functions that reference a column, table or type that does not exist.
 *
 * Nineteen of them on 2026-08-28, silently, for months: likes, dislikes,
 * replies, deleting a post and quote replies were all dead in production, along
 * with four AI-withdrawal functions and both nearby searches. Every one looked
 * healthy — defined, routable, called by the app — because plpgsql only plans a
 * statement when it runs, so a write to a missing column raises 42703 at call
 * time and never before.
 *
 * Nothing else in the stack sees this. Unit tests mock the database;
 * check-rpc-exists proves a function is DEFINED, which all of these were;
 * migration replay proves the SQL applies, and creating a function never
 * validates its body.
 *
 * A ratchet rather than a demand for zero: eleven remain after the timeline
 * ones were repaired, and each of those needs a decision rather than a
 * mechanical edit (does `ai_creator_withdrawals` want a `completed_at` column,
 * or should the write go?). Demanding zero tomorrow would make this red about
 * work that is queued, which is how a gate teaches people to ignore it.
 * `SELECT * FROM list_broken_plpgsql_functions()` names them.
 */
const BROKEN_FUNCTION_BASELINE = 11;

async function checkBrokenFunctions() {
  const count = Number(await rpc('count_broken_plpgsql_functions'));

  if (count > BROKEN_FUNCTION_BASELINE) {
    violation(
      'functions.reference_missing_objects',
      `${count} plpgsql function(s) reference something that does not exist, up from ` +
        `${BROKEN_FUNCTION_BASELINE}. A new one will fail only when a user triggers it, with ` +
        `42703 and no other symptom — run list_broken_plpgsql_functions() to see which`,
      []
    );
  } else {
    notes.push(
      `functions: ${count} reference a missing object (baseline ${BROKEN_FUNCTION_BASELINE}, never rises)`
    );
  }
}

/**
 * You can read the Cat's answer on your own private post.
 *
 * The Cat replies with the parent's visibility, which is correct, but the reply
 * is authored by the CAT — and the rule for a private event is
 * `actor_id = auth.uid()`. So on 2026-08-28 the answer to a private question
 * was visible to exactly one account, and it was not the asker's. Measured on
 * post 5c3ad8ef: three replies existed, the author could see two, and the
 * missing one was the answer they had asked for.
 *
 * Gated here because the failure is SILENT. Nothing errors — the Cat answers,
 * the row exists, and the thread simply renders without it, which reads as the
 * Cat having ignored you. Whoever rewrites this policy next gets no warning if
 * the clause goes.
 */
async function checkCatAnswersAreReadable() {
  const allowed = await rpc('timeline_policy_allows_own_thread');

  if (allowed !== true) {
    violation(
      'timeline.own_thread_readable',
      `the timeline SELECT policy no longer lets you read replies on your own private posts, so ` +
        `the Cat answers private questions where the person who asked cannot see them — the reply ` +
        `is written, and the thread renders as though it never came`,
      []
    );
  } else {
    notes.push('timeline: you can read replies on your own private posts');
  }
}

async function checkOrphanedProfiles() {
  const count = Number(await rpc('count_orphaned_profiles'));

  if (count > 0) {
    violation(
      'profiles.orphaned',
      `${count} profile(s) have no auth user — a deleted account left its public profile behind, ` +
        `and every user-count metric is inflated by that much`,
      []
    );
  } else {
    notes.push('profiles: every profile belongs to a live auth user');
  }
}

/**
 * Cat conversations whose owner is gone.
 *
 * cat_conversations.user_id carried no foreign key at all until 2026-08-07,
 * while every sibling in the family (cat_messages, cat_memories,
 * cat_pending_actions, wallets) already cascaded from the account. Deleting a
 * user therefore removed their profile, memories, pending actions and wallets
 * and left their conversations — private chats with Cat — standing forever.
 *
 * The migration's ON DELETE CASCADE makes new orphans impossible; this is the
 * backstop for the constraint being dropped or written around, exactly as
 * checkOrphanedProfiles is for #637.
 *
 * Checked against `profiles` rather than auth.users: profiles cascade from
 * auth.users, so "no profile" and "no account" are the same set, and profiles
 * is reachable through PostgREST without another service_role-only function.
 */
async function checkOrphanedCatConversations() {
  const convs = await rest('cat_conversations?select=id,user_id');
  if (convs.length === 0) {
    notes.push('cat_conversations: table is empty');
    return;
  }
  const ownerIds = [...new Set(convs.map(c => c.user_id))];
  const live = new Set();
  // Chunked so the id list cannot outgrow the URL as the table grows.
  for (let i = 0; i < ownerIds.length; i += 100) {
    const chunk = ownerIds.slice(i, i + 100);
    const found = await rest(`profiles?select=id&id=in.(${chunk.join(',')})`);
    for (const p of found) {
      live.add(p.id);
    }
  }

  const orphans = convs.filter(c => !live.has(c.user_id));
  if (orphans.length > 0) {
    violation(
      'cat_conversations.orphaned',
      `${orphans.length} conversation(s) belong to accounts that no longer exist — ` +
        `a deleted account left its private Cat history behind`,
      orphans.slice(0, 5).map(o => o.id)
    );
  } else {
    notes.push(
      `cat_conversations: ${convs.length} conversation(s), all owned by a live account`
    );
  }
}

/**
 * Actors whose account is gone.
 *
 * `actors.user_id` is the last member of this family carrying NO foreign key —
 * profiles (#637) and cat_conversations (#651) both cascade now, and the sweep
 * that fixed them stopped one table short. So deleting an account still leaves
 * its actor standing: the row that owns every product, service, project, cause,
 * event, loan and asset the person ever created.
 *
 * Unlike its siblings this cannot be closed by adding `ON DELETE CASCADE`, and
 * that is why it is a check rather than a migration:
 *
 *   - CASCADE would delete the actor, which cascades on into `contracts`,
 *     `investments` and `bookings` — destroying the COUNTERPARTY's record of an
 *     agreement because the other side closed their account.
 *   - SET NULL is rejected outright by `actor_type_check`, which requires
 *     `actor_type = 'user'` to have a non-null `user_id`.
 *
 * The honest fix is a tombstone — keep the actor, sever the identity — which
 * needs a deleted/anonymous actor_type and so is a schema decision, not a
 * drive-by. Until that lands this check is what stands between the leak and
 * silence, and it is not a formality: 15 orphaned actors were live in
 * production when it was written.
 *
 * Checked against `profiles` rather than auth.users, for the same reason as
 * checkOrphanedCatConversations: profiles cascade from auth.users, so "no
 * profile" and "no account" are the same set, reachable through PostgREST
 * without another service_role-only function.
 */
async function checkOrphanedActors() {
  const actors = await rest('actors?select=id,user_id,display_name&user_id=not.is.null');
  if (actors.length === 0) {
    notes.push('actors: no user-owned actors');
    return;
  }
  const ownerIds = [...new Set(actors.map(a => a.user_id))];
  const live = new Set();
  // Chunked so the id list cannot outgrow the URL as the table grows.
  for (let i = 0; i < ownerIds.length; i += 100) {
    const chunk = ownerIds.slice(i, i + 100);
    const found = await rest(`profiles?select=id&id=in.(${chunk.join(',')})`);
    for (const p of found) {
      live.add(p.id);
    }
  }

  const orphans = actors.filter(a => !live.has(a.user_id));
  if (orphans.length > 0) {
    violation(
      'actors.orphaned',
      `${orphans.length} actor(s) belong to accounts that no longer exist — ` +
        `a deleted account left behind the row that owns everything it published`,
      orphans.slice(0, 5).map(o => o.display_name || o.id)
    );
  } else {
    notes.push(`actors: ${actors.length} user actor(s), all owned by a live account`);
  }
}

async function main() {
  const checks = [
    checkOrphanedWalletLinks,
    checkDuplicatePrimaryLinks,
    checkUnpayableActiveWallets,
    checkPaidWithoutTimestamp,
    checkSilentlyDroppedCatTurns,
    checkOrphanedProfiles,
    checkEmailDerivedUsernames,
    checkEmailDerivedNames,
    checkCatHandle,
    checkCatAnswersAreReadable,
    checkBrokenFunctions,
    checkOrphanedCatConversations,
    checkOrphanedActors,
  ];

  for (const check of checks) {
    try {
      await check();
    } catch (err) {
      // A check that cannot run is itself a finding — never let an exception
      // read as "invariant holds".
      violation(check.name, `check failed to run: ${err.message}`, []);
    }
  }

  console.log('OrangeCat data invariants —', new Date().toISOString());
  for (const n of notes) {
    console.log(`  ok    ${n}`);
  }
  for (const v of violations) {
    console.log(`  FAIL  ${v.name}: ${v.detail}`);
    if (v.sample?.length) {
      console.log(`        e.g. ${v.sample.join(', ')}`);
    }
  }

  if (violations.length === 0) {
    console.log('All invariants hold.');
    process.exit(0);
  }
  console.log(`${violations.length} invariant(s) violated.`);
  process.exit(GATE ? 1 : 0);
}

main().catch(err => {
  console.error('check-data-invariants failed:', err);
  process.exit(2);
});

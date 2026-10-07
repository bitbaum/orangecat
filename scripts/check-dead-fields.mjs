#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * check-dead-fields.mjs — dead-field ratchet.
 *
 * A "dead field" is a field a user can fill in that no page ever shows back:
 * declared in a Zod schema under src/lib/validation/, carried through the domain
 * and API layers, stored in Postgres — and referenced by no component and no
 * page. The data is collected and then silently swallowed.
 *
 * This is not hypothetical. Two shipped instances:
 *
 *   - `portfolio_links` (fixed 2026-08-24): users pasted their portfolio URLs
 *     into the service form and no page rendered them.
 *   - the loan refinance block (fixed 2026-08-25): a borrower states their
 *     CURRENT rate and their DESIRED rate — the two numbers that define a
 *     refinance — and the public loan page rendered neither, while rendering
 *     `monthly_payment` from the same form section. Half-rendering is what made
 *     it invisible: the section looked complete.
 *
 * Fixing the second instance is where the Never-Twice rule says to stop fixing
 * and start automating, so: this gate. It FAILS when a schema field is dead and
 * not listed in KNOWN_DEAD below. The baseline is a one-way ratchet — entries
 * come out when a field starts rendering, and nothing goes in without a written
 * reason on the line.
 *
 * Deliberate scope: the "rendered" surface is src/components/** and src/app/**
 * minus src/app/api/**. Domain services, API routes and generated types do not
 * count as rendering — passing a value along is not showing it to anyone. Entity
 * form configs do not count either: an input the user types into is the source
 * of the problem, not evidence against it.
 *
 * Run: npm run check:dead-fields   (part of `npm run verify`; exit 1 on FAIL)
 *      node scripts/check-dead-fields.mjs --list   (print current dead fields)
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

/**
 * Fields that are currently not rendered, each with the reason it is allowed.
 * This list is a one-way ratchet: it may shrink freely, and an entry must not be
 * added without a reason written on the line. When a field starts rendering, the
 * check FAILS until its entry is deleted — that is how a gain gets locked in.
 *
 * The third group is debt, not absolution. Those fields are content a reader
 * would want and no page shows; they are listed so the gate can hold the line at
 * today's count instead of being deleted for being noisy. Shrink it.
 *
 * Baseline history:
 *   42 (2026-08-25) — established. Measured 48 before the same commit rendered
 *                     the loan refinance terms and the event venue address,
 *                     online join link, RSVP deadline and all-day flag. Those
 *                     six came off by being fixed, not by being excused.
 *   32 (2026-08-25) — service delivery/area, wishlist item quantity + partial
 *                     funding, event recurrence + video, loan term.
 *   26 (2026-08-26) — investment `return_frequency` rendered (a rate without its
 *                     cadence is half a term, and the card already showed the
 *                     rate); the wishlist dedicated-wallet pair DELETED, being
 *                     unreachable from every direction.
 *   29 (2026-08-26) — the assistant pair, resolved in opposite directions:
 *                     free_messages_per_day now renders (it is enforced), and
 *                     knowledge_base_urls was DELETED from the schema (it is
 *                     not — nothing reads those URLs). A field can leave this
 *                     list by being shown or by being admitted not to exist;
 *                     what it must never do is leave by being displayed as
 *                     something the system does not actually do.
 */
const KNOWN_DEAD = new Set([
  // === Identifiers and routing plumbing — never reader-facing content. =======

  // --- Rendered, but through a parent the scanner cannot follow. -------------
  // These three are properties of `recurrencePatternSchema`, i.e. they live
  // INSIDE the `recurrence_pattern` JSONB column — they are not columns of their
  // own. `recurrence_pattern` IS rendered (event.tsx → formatRecurrence), which
  // displays all three, so they are not dead.
  //
  // Two scanner limits meet here, and both are deliberate to leave alone:
  //   1. The field regex reads every schema property as top-level, so a nested
  //      sub-schema's members look like columns.
  //   2. Only src/components and src/app count as render surfaces, and the
  //      formatter is a pure helper in src/lib — correctly, by separation of
  //      concerns. Widening the scan to src/lib would let non-render code vouch
  //      for a field and mask genuinely dead ones, which is exactly the mistake
  //      that create-templates caused on this checker's first run.
  // Fixing this properly means teaching the scanner that `X: someSubSchema`
  // makes X the parent of that schema's members. Worth doing when a second
  // nested schema appears; one instance does not justify the machinery.
  'days_of_week',
  'day_of_month',
  'month_of_year',
  'from_wallet_id', // FK: internal transfer source
  'to_wallet_id', // FK: internal transfer destination
  'product_id', // FK: wishlist item → catalogue product
  'service_id', // FK: wishlist item → catalogue service
  'shipping_address_id', // FK: order → saved address
  'compute_provider_id', // FK: assistant → compute provider record
  'buyer_note', // private note from buyer to seller; order-scoped, not public
  'external_source', // provenance of an imported wishlist item
  'is_featured', // platform curation flag, set by us and not by the owner

  // === Operator/runtime configuration — deliberately not public. =============
  // Publishing these would expose how an assistant is built, not what it offers.
  'system_prompt', // the operator's instructions; publishing it gives it away
  'temperature',
  'model_preference',
  'max_tokens_per_response',
  'api_provider',
  'compute_provider_type',

  // === Debt: reader-relevant content with no surface yet. ====================
  // Each line is a page that should show a thing it currently swallows. Removing
  // a line by rendering the field is always the preferred way to fix a failure
  // of this check.
  // NOT debt awaiting a surface — a form choice nothing branches on. Products
  // offer Manual/Automatic/Digital Delivery and loans offer Manual/Automatic
  // Deduction, and no code anywhere reads the value to behave differently; on
  // products it merely restates `product_type` (identical in all 11 prod rows).
  // Rendering it would promise a fulfilment mechanism that does not exist, so
  // resolving it is a product decision — build it, or drop the option — not a
  // rendering task. Left here deliberately, with the truth written down.
  'fulfillment_type',
  'allocations', // funding splits
  'beneficiaries', // funding splits
  'distribution_rules', // funding splits
  'budget_amount', // funding target
  'budget_period', // funding target window
  'goal_deadline', // funding target date
  // Recurring events: needs one renderer that turns the whole set into a human
  // sentence ("every second Tuesday"), so these five come off together.
]);

/** Walk a directory, returning every .ts/.tsx path beneath it. */
function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) collect(path, out);
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

const files = collect(SRC);
const rel = f => relative(ROOT, f);

// --- 1. Every field name declared in a validation schema ---------------------
// The RHS must look like a validator call or member access — `z.number()`,
// `optionalText(100)`, `webUrl()`. That shape is what distinguishes a schema
// field from an options object or an error-message literal. An earlier version
// of this scan hardcoded `z.|webUrl|optionalUrl` and therefore never saw
// `current_lender: optionalText(100)` — the bug it was written to find.
// The key must open a line or follow `{`/`,` so it is a property and not, say,
// a ternary branch. Anchoring on INDENTATION instead (an earlier version did)
// silently skipped every schema Prettier kept on one line — found by mutation-
// testing this gate rather than by trusting it.
const FIELD_DECL = /(?:^|[{,])\s*([a-z][a-z0-9_]{2,})\s*:\s*[A-Za-z_$][\w$]*\s*[(.]/gm;

const declared = new Map(); // field -> declaring file (first seen)
for (const file of files.filter(f => f.includes('/lib/validation/'))) {
  const src = readFileSync(file, 'utf8');
  for (const match of src.matchAll(FIELD_DECL)) {
    if (!declared.has(match[1])) declared.set(match[1], rel(file));
  }
}

// --- 2. Every field name a component or page mentions ------------------------
// src/components/create/** is excluded for the same reason as entity-configs:
// it is the form machinery. A field named only in a create template is PREFILLED
// INPUT, not output — counting it as rendered is what hid `venue_name`,
// `venue_country` and `online_url` on the first run of this scan.
const renderFiles = files.filter(
  f =>
    (f.includes('/src/components/') || f.includes('/src/app/')) &&
    !f.includes('/src/app/api/') &&
    !f.includes('/entity-configs/') &&
    !f.includes('/src/components/create/')
);
const rendered = renderFiles.map(f => readFileSync(f, 'utf8')).join('\n');

// --- 3. Compare ---------------------------------------------------------------
const dead = [];
for (const [field, from] of declared) {
  if (!rendered.includes(field)) dead.push({ field, from });
}
dead.sort((a, b) => a.from.localeCompare(b.from) || a.field.localeCompare(b.field));

const unexpected = dead.filter(d => !KNOWN_DEAD.has(d.field));
const deadNames = new Set(dead.map(d => d.field));
const stale = [...KNOWN_DEAD].filter(f => declared.has(f) && !deadNames.has(f));

if (process.argv.includes('--list')) {
  for (const d of dead) console.log(`${d.field}\t${d.from}`);
}

console.log(
  `[check-dead-fields] schema fields: ${declared.size} — ` +
    `never rendered: ${dead.length} — allowed by baseline: ${KNOWN_DEAD.size}`
);

let failed = false;

if (unexpected.length > 0) {
  failed = true;
  console.error(
    `\n[check-dead-fields] FAIL: ${unexpected.length} field(s) are collected but never shown:\n` +
      unexpected.map(d => `    ${d.field}  (declared in ${d.from})`).join('\n') +
      `\n\n  Render the field on the entity's detail config under\n` +
      `  src/components/public/detail-configs/, or — if it genuinely has no\n` +
      `  reader-facing surface — add it to KNOWN_DEAD in this file WITH the reason.\n` +
      `  Do not delete the check to make this pass.`
  );
}

if (stale.length > 0) {
  failed = true;
  console.error(
    `\n[check-dead-fields] FAIL: ${stale.length} baseline entr(y|ies) now render and must be removed:\n` +
      stale.map(f => `    ${f}`).join('\n') +
      `\n\n  The baseline only shrinks. Delete these lines from KNOWN_DEAD to lock the gain.`
  );
}

if (failed) process.exit(1);

console.log('[check-dead-fields] OK — every collected field is either rendered or accounted for.');

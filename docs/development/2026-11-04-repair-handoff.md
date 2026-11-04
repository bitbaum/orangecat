# Fleet repair handoff — 2026-11-04

This continues the supplied Fleet System Review and mobile screenshots. The
application-wide audit is unfinished. Keep OrangeCat active until its declared
journeys work before beginning Loki/Solon implementation. See the acceptance
queue in [the repair ledger](2026-11-03-fleet-repair-ledger.md) and today's
independent [site handoff](../HANDOFF-2026-11-04.md) and
[site audit](../operations/SITE_AUDIT.md). Preserve that work.

## Confirmed results

- PR #1542: deployed commit `c3ffe478`, CD run `41619850487` verified the live
  receipt. Permission resolution is shared by settings and execution, presets
  are atomic, high-risk confirmation mandatory, overlapping confirmations claim
  an action once, and accounting-read failures stop execution. Recovery hides
  unavailable credit commerce. Observed AI completions are separate from
  process liveness. Signed-in production copy, recovery and health checked.
- A real contextual Heidi question still failed after that deployment. Provider
  pings returning success do not establish a working contextual turn.
- PR #1543: merged by fleet sweep as `702d5593`. Application checks, browser
  smoke and complete migration replay passed on source `506e0f2`. All 5,628
  tests passed in its normal push checks. Failed replies now persist explicit
  error metadata, retain settled tool outcomes and partial text, reopen with
  recovery controls, and are excluded from subsequent model context.
- Main CI run `41842072875` initially failed in `check:broken-words` waiting for signed-in
  navigation (30-second timeout); its route contract passed 19 tests, static
  verification and security passed. Failed jobs were rerun once and passed. CD `41845445046` verified live
  receipt `702d5593`. A real failed question reloaded with recovery and settled
  tool outcomes, no unavailable top-up and no normal answer Copy button. The
  test conversation was deleted. The screenshot also exposed timestamp-tie
  message ordering (reply above question) and an overlapping floating launcher;
  these remain explicit follow-up work.
- Read-only diagnostics run `41842200437` succeeded through the existing deploy
  connection. Last-hour aggregate had zero matching errors. This neither proves
  healthy conversations nor explains yesterday's failure. Reproduce, rerun,
  and check log coverage if an observed failure still yields zero matches.
- Grok's upload, service-price, profile navigation, timeline, message-picker,
  Contact and receipt changes are preserved. Its handoff records which were
  exercised live; merged status alone does not upgrade remaining verification.

## Latest reproduction and server evidence

At approximately 13:59 UTC, the real Heidi question in an ephemeral conversation
returned an `AI_RATE_LIMITED` error after 29.6 seconds. The test conversation was
deleted. Diagnostic run `41843315466` then matched four records: one HTTP 429,
one HTTP 404 (unavailable endpoint/model) and two errors without classifiable
status. This confirms multiple failure types along the chain; do not reduce the
whole problem to a personal usage allowance or claim the failure is solved.

## Current narrow privacy change

PR #1556, branch `fix/cat-context-and-mobile-state`, source `0977d48`.
Normal push gates passed all 5,637 tests; all application CI jobs passed. Fleet
sweep/deployment and live consent verification remain to be recorded.
The change prevents passive economic-profile learning from temporary turns in
both streaming and non-streaming completion paths. It uses the existing memory
consent reader, skipping extraction when memory is disabled or consent cannot
be read. An unknown conversation privacy state skips learning too.

Focused tests: 50 orchestrator/consent tests, plus 8 preparation/privacy tests
passed. The transitive no-background-AI guard initially followed the new consent
reader into the mixed memory module. Registering this read-only helper in its
existing safe-function list passed all 12 guard tests, including the check that
each safe function body calls no model sink. Full verification and normal commit/push gates must pass on the final
source before opening a non-draft PR. No schema change is needed for this slice.
It does NOT add public-offerings consent or claim that all privacy work is done.

## Next actions, in order

1. Check the rerun of main CI `41842072875`; inspect actual errors if still red.
   Verify CD's receipt for `702d5593`, then reopen a failed chat in the live UI
   and confirm recovery controls, retained outcomes and no normal-answer footer.
2. Finish and ship the narrow privacy change through normal hooks and the fleet
   sweep. Verify its deployment. Do not manually merge or force-push.
3. Reproduce the Heidi question in a temporary chat using the existing approved
   account or an isolated QA account. Save response privately, delete the test
   conversation, run `cat-diagnostics.yml`, then fix the evidenced failure.
   Browser-page fetch uses the environment network path; Playwright's separate
   request context attempted direct TCP and was refused. Catch errors and print
   only safe summaries: request errors can contain authentication headers.
4. Add owner-controlled public economic offerings, private by default. Current
   `user_economic_profile_public` view exposes passively inferred offering fields
   without a separate sharing choice. Use an additive immutable migration,
   owner-only visibility control, explicit public preview and tenant checks.
5. Complete permission mixed-state display, accurate integration linkage versus
   capability labels, modal/widget suppression using the shared host contract,
   and keyboard/mobile journeys. No independent modal-detection implementation.
6. Verify independent accounts, guessed IDs, revoked grants and cross-app
   handoffs. Email/Telegram delivery, Loki Workbench's absent idle composer,
   and Solon membership/decision journeys remain open. Do not send messages to
   people or execute payments as a verification shortcut.

## Continuation mechanics

Use `gh` normally. Existing GitHub Actions deployment credentials work; do not
ask the owner to resend SSH keys. Dispatch diagnostics after a reproduction:
`gh workflow run cat-diagnostics.yml -R bitbaum/orangecat`.

Local evidence and approved browser session are under
`/workspace/review-evidence/` (private, do not commit). Full review: `REVIEW.md`.
Final checks: `privacy-verify.log`; focused checks: `privacy-focused.log` and
`privacy-guards.log`. Never publish account secrets, session files, private
conversation bodies or screenshots. No generated live DB types were hand-edited.

Distinguish implemented, checked, merged, deployed and exercised. A live process
or green CI does not close the contextual-conversation acceptance criterion.

## Additional active repairs

Routing PR #1557, source `50a9fb8`, passed normal hooks and 5,631 tests. It awaits
application CI and deployment. The first chat awaits a bounded live catalogue
resolution, and live discoveries replace retired registry entries when none of
the registry survives. No quota availability is promised. See its dated routing
document on that branch.

Public offerings consent is implemented separately in `fix/cat-offerings-consent`
with an additive migration, authenticated owner control, public preview and
local policy/browser tests. See [its evidence and gates](2026-11-04-offerings-consent.md).
Do not confuse either privacy repair with deployed provider capacity.

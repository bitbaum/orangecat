# Fleet repair ledger

This is the execution plan for the owner's integrated OrangeCat/Loki review.
One application is active at a time; a merged fix closes only its declared scope.

| Order | Scope                                                                        | Required evidence                                                                    | State                           |
| ----- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------- |
| 1     | OrangeCat provider routing, truthful recovery and local-inference disclosure | alternate-provider-only regression, failure UI, existing-account grounded completion | active                          |
| 2     | Effective permissions, atomic presets and single-claim confirmations         | precedence/default/risk tests, batch failure and concurrent confirmation tests       | active, same correctness change |
| 3     | OrangeCat activity, integration states and overlay hierarchy                 | error/empty distinction, scoped capability labels, mobile sheets/keyboard            | queued                          |
| 4     | Loki idle Workbench, in-place start and coherent execution states            | idle → send → queue → session → result in one workspace                              | queued                          |
| 5     | Identity, independent enrollment and tenant isolation                        | unrelated users/member, guessed IDs, expired/revoked grants, cross-app handoff       | queued                          |
| 6     | Email and Telegram delivery contracts                                        | accepted/delivered/failed status, user-scoped routing, link/unlink                   | queued                          |
| 7     | Solon integration and governance                                             | membership, project binding, signed eligible decision                                | queued                          |
| 8     | Fleet efficiency and remaining review reconciliation                         | measured CI/restarts, package bindings, journey evidence                             | queued                          |

For each change record: source SHA, focused and full checks, PR, deployed SHA,
and exercised journey. Never record a healthy process as a successful AI answer.
The reproduced provider failure needs server-side evidence; unused personal
allowance does not establish available shared capacity. No API keys, account
passwords, session cookies or private conversation bodies belong in this ledger.

## First OrangeCat correctness change

Deployed as `c3ffe478` through PR #1542; production permission/recovery/health
checks recorded in [the current handoff](2026-11-04-repair-handoff.md):

- Shared effective-permission resolver for execution, summary and action autonomy;
  high-risk confirmation remains mandatory even for older stored grants.
- Atomic preset/category writes, with individual spending caps retained; settings
  readers synchronize from the canonical refreshed snapshot.
- Conditional pending-action claim before any handler, with permission revocation
  checked again and failed claims prevented from executing.
- Failed spending-accounting reads stop execution instead of assuming zero usage.
- Platform routing uses the actual configured chain, including alternate providers.
- Recovery omits unavailable credit top-ups and no longer promises a one-minute
  quota reset. Local inference copy discloses server storage/action traffic.
- Completion observations are reported separately from process liveness; unprobed
  Bitcoin integration reads unknown. Activity read errors have a retry state.

Focused regressions cover effective precedence/defaults, mandatory confirmation,
atomic preset failure, concurrent confirmation, revocation, alternate-provider-only
routing and closed-credit recovery. The first full check run passed all static
lanes and 5,603 tests; one snapshot needed the intentional rate-limit copy change.
The updated orchestrator suite then passed all 45 tests. Final checks and served
artifact verification remain required before any item above is called deployed.

Still open in this application: the exact existing-account contextual completion
failure, historical failure rendering, tenant-isolation journeys, integration
capability labels, modal/widget interaction, and independent email/Telegram delivery
proof. The existing GitHub Actions deployment connection supports read-only server
diagnostics; no new host credentials are requested.

## Durable failures and safe diagnostics

Prepared after the first correctness change; deployment is not yet verified.
The additive migration stores a failed turn's structured state, and conservatively
marks exact historical application errors. Failed replies reopen through ChatKit's
failure renderer and recovery footer; partial text is retained under a disclosure.
Failed exchanges are excluded from subsequent model history. A required failure
history write reaches the logging path on error instead of silently claiming a
save. Generated live database types are not edited by hand; regenerate them after
the migration through the documented database-types workflow.

Local evidence: focused history/store/orchestrator tests, migration version and
schema checks, plus applying the migration/backfill and invalid-JSON checks in
PGlite. This is PostgreSQL-compatible local evidence, not production migration
proof or a two-tenant isolation test. The migration replay workflow and deployment
receipt are still required.

The on-demand Cat diagnostics workflow reuses the existing deployment connection.
It reads a bounded journal window and publishes only aggregate categories and HTTP
status codes. Its parser has a regression asserting private log values never reach
the report. It does not change services, read credentials or send notifications.

Release tracking: the first correctness change is PR
[1542](https://github.com/bitbaum/orangecat/pull/1542), source commit
`6efe527`. Local full verification and all PR checks passed, including built-app
browser smoke and responsive word checks. The deployed receipt was verified in CD run `41619850487`. The durable-failure slice
also retains final tool outcomes when synthesis fails, rather than losing the
record of an action that may already have run; intermediate chips are settled by
ID instead of duplicated.

## Current continuation

See [the 2026-11-04 repair handoff](2026-11-04-repair-handoff.md) for merged
PR #1543, its deployment gate, the narrow privacy repair and exact remaining
acceptance criteria. Earlier preparation notes describe their recorded stage.

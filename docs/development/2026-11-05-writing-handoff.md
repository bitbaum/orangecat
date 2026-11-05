# Shared authoring extraction checkpoint

The user wants one coherent article-writing workflow and reusable content
adaptation across OrangeCat, BiasLens and Heidi, with future client use through
Loki. The decision and ownership boundaries are recorded in
[Fleet's dated content plan](https://github.com/bitbaum/fleet/blob/main/docs/content-workflow-plan-2026-11-05.md).
The shared completion procedure governs interruption checkpoints and releases.

## This branch

`feat/writingkit-core` contains bootstrap source in `packages/writingkit`.
`WritingSession` coordinates one operation, captures its document/revision,
rejects stale responses and invalidates cancelled/disposed work even when the
provider ignores abort. Its public apply callback is synchronous. The package
has its own build/type/runtime checks, wired into the application's verify gate.

No application imports this source folder. No package is registered, published
or adopted merely because the folder exists. Account-owned storage, publishing,
model transport, source provenance, labels and dialect checks retain their
existing owners. Cancellation cannot roll back a server-side write.

## Preserved UI work

An unfinished article workflow repair exists separately on local branch
`fix/article-writing-workflow`: one Ask Cat controller, editor first, compact
draft library, cancellation/stale protection and one-step Undo. Its 23 focused
tests passed before this extraction; full verification and browser acceptance
remain open. It is not released. The local branch and patch require explicit
transfer if the original workspace is unavailable; they are not a pushed backup.
Do not overwrite that work or call it implemented by this bootstrap branch.

## Resume

1. Verify this bootstrap branch and inspect its PR checks before declaring it
   ready. The package command is `pnpm run check:writingkit`; full verification
   is `pnpm run verify`, with the repository's normal commit/push hooks intact.
2. After the source is merged, declare the standalone package in Fleet's
   package-repository register using this folder as its bootstrap source. Let
   the normal workflow create and verify it, then inspect the actual registry
   artifact and publishing result. Configure its first-consumer rollout.
3. Consume that published version in the preserved OrangeCat article repair.
   Retire the bootstrap runtime copy and temporary `check:writingkit` binding
   as part of adoption; future engine changes belong in the standalone repo.
   Synchronize committed revisions and dispose the session synchronously on
   draft/account changes. Account for React Strict Mode's effect replay by
   constructing a new owner in effect setup.
4. Verify manual edits while generating, change/revert, switches, cancellation
   followed by another request, stale title choices and Undo. Exercise the actual
   mobile editor, draft recovery, preview and publishing controls before release.
5. Add BiasLens and Heidi adapters only through the released package. Preserve
   BiasLens server revision/capability checks and labelled output; preserve
   Heidi's existing target/bridge variety-pack boundary and language checks.

## Other completed work and remaining queue

BiasLens [#187](https://github.com/bitbaum/biaslens/pull/187) repaired long-text
overflow. Its deployed commit was
`ed93e661d9e9988b1ce8133b6893c088064a057d`, confirmed by the public receipt and
the controlled source/rewrite journey at 320/390/834/1440px. Its menu already
uses sitekit; grouped navigation remains an upstream package task, not a local
menu replacement. Broader BiasLens workspace consolidation remains open.

Earlier OrangeCat [#1562](https://github.com/bitbaum/orangecat/pull/1562) and
Loki [#1588](https://github.com/bitbaum/loki/pull/1588) shipped bounded repairs.
They do not close the wider account/tenant, real-builder, mobile keyboard,
communication-delivery or governance audit. Recheck remote heads, current
receipts, git status and running jobs on resume; this dated record is evidence
of its checkpoint rather than a substitute for current release status.

# Article writing — adoption checkpoint

The user wants coherent writing/adaptation across OrangeCat, BiasLens and Heidi,
with reusable packages for later studio customers through Loki. The ownership
boundary is [Fleet's content plan](https://github.com/bitbaum/fleet/blob/main/docs/content-workflow-plan-2026-11-05.md).
Follow Fleet's repository completion procedure, including early agent-neutral
checkpoints. Do not infer deployment from a source commit.

## Current implementation

The editor leads with title/body. One Ask Cat controller handles generation,
topics and edits. The account/device draft library is a dialog; older draft
recovery retains explicit ownership confirmation. Preview and publishing remain
distinct. Cancellation, stale-result rejection and safe one-step Undo belong to
the active draft. Native controls have 44px targets; untrusted long titles/text
wrap inside preview/library surfaces.

The controller imports WritingSession from
[@bitbaum/writingkit](https://github.com/bitbaum/writingkit), verified tag
`v0.1.0`, commit `b167b55c1cd06e3234a5a1001e98197759ee5d6b`. Exact-commit package
CI passed, and the installed compiled entry matched the verified source. The
lockfile pins its immutable Git artifact and integrity. Initial npm publication
was skipped; this is a supported verified Git installation, not an npm artifact.

Bootstrap source from OrangeCat #1563 is retired in this adoption branch. Future
engine changes belong in WritingKit's own repository. Product fields, selection,
Undo, account/device storage, API/model execution and publication retain their
existing owners. Operation identity is scoped by the editor's draft/account
React key. A layout effect creates a fresh owner on setup and disposes it
synchronously on cleanup, including Strict Mode replay. A UI-only nonce prevents
an old completion from replacing a newer notice.

## Verification and release

- Focused lifecycle/library/navigation/scheduler checks passed with the actual
  installed package. Coverage includes Strict Mode, manual edits during
  generation, change/revert, cancelled versus newer work, unmount, stale titles
  and guarded Undo.
- `pnpm run test:article-writing-browser` renders the actual composer and CSS
  with controlled AI/auth/publish/upload boundaries. It checks phone/tablet/
  desktop layout, generation, Undo, the library, Preview/Write, long input,
  native button targets and saved-draft reload. CI retains screenshots. This is
  not a real signed-in routed publish or a physical OS-keyboard journey.
- Required full application verification, normal hooks and final-source CI must
  pass before readiness. Record results in the PR rather than assuming them.
- Keep first adoption draft while Fleet configures the canary with this actual
  candidate's `bootstrapPr` pointer. Its audit can read the candidate's real
  dependency, plan and source. Require normal CI/browser and rollout gates before
  readiness. Never waive a hold or merge manually; use the fleet sweep.
- After deployment, record the served receipt and current-artifact journey.

The earlier UI patch was retained in a local stash during the fast-forward to
#1563. It was reapplied; the package-plan conflict kept the app scope and replaced
bootstrap metadata with the runtime binding. Keep recovery copies until verified
work is pushed. On another machine, resume from the pushed branch and PR; local
scratch paths are not remote backups.

## Remaining cross-product work

BiasLens #187's overflow repair deployed as
`ed93e661d9e9988b1ce8133b6893c088064a057d`, confirmed by its public receipt and
controlled live-site journey at 320/390/834/1440px. Its navigation already uses
sitekit; a grouped menu needs an upstream package change. The wider article
workspace consolidation remains open.

Heidi already separates target/bridge varieties into packs. Future article
adaptation must preserve those, source references and generated-text labels.
No Heidi reading feature is implemented here. BiasLens keeps its evidence,
citation, simulation-label and server capability/revision policies. Browser
cancellation cannot roll back an existing server write.

Earlier OrangeCat #1562 and Loki #1588 shipped bounded repairs; wider tenant,
real-builder, mobile keyboard, communication-delivery and governance audits
remain open. Recheck current remote heads, receipts and running jobs on resume.

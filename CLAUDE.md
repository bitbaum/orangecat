# OrangeCat

AI-native platform for universal economic and governance participation — "My Cat" AI agent enabling any identity to earn, fund, lend, invest, and govern freely with any currency.

Loki (rebranded from Cockpit) is a live customer project (see "Loki" and "OrangeCat" projects under Cato on this platform). Typed "customer" stakeholder edge + shared BTC wallet. Integration is real: Loki production layer + OrangeCat economic layer. Changes here (e.g. stakeholder_relationships, project profiles) directly improve UX for Loki (the customer) and all future customers.

@~/.claude/CLAUDE.md
@.claude/CLAUDE.md

Org rules are [bitbaum/fleet AGENTS.md](https://github.com/bitbaum/fleet/blob/main/AGENTS.md): packages by default (say why if you skip one), search through `@bitbaum/searchkit`, chat through `@bitbaum/chatkit`, shared names and the identity contract. Read that file. Do not restate it here.

## Stack

| Layer      | Technology                                                                          |
| ---------- | ----------------------------------------------------------------------------------- |
| Framework  | Next.js 16, React 19, TypeScript 6.x                                                |
| Styling    | Tailwind CSS 4                                                                      |
| Database   | Self-hosted Supabase (PostgreSQL + Auth + RLS) — `supabase.orangecat.ch` on Hetzner |
| Bitcoin    | Lightning Network, BTCPay, NWC                                                      |
| Deployment | Self-hosted on Hetzner (`bitbaum`, behind Caddy)                                    |

---

## Design System

### Token SSOT: `src/app/globals.css`

Every color, radius, shadow, tracking, and layout primitive is defined as a CSS custom property in `src/app/globals.css`. `tailwind.config.ts` only maps Tailwind utility classes onto those vars — it never declares a literal hex.

The design system runs in **two concentric layers**:

1. **Legacy layer** (in active use): shadcn/ui-style `--background`, `--foreground`, `--card`, `--primary`, etc. as HSL channel values; brand palette `--tiffany-{50..900}`, `--orange-{50..900}`, `--bitcoin-orange` as RGB channels. Utility classes: `bg-card`, `text-foreground`, `bg-tiffany-500`, `bg-bitcoinOrange` etc.

2. **Loki-aligned semantic tier** (migration target, added in commit eff99bad): `--text-primary/secondary/tertiary/muted/inverted`, `--surface-page/base/raised/overlay/modal/drawer/public`, `--border-default/interactive`, `--accent-primary/hover` (→ `#ff5c00`), `--status-positive/warning/negative/neutral` with `-subtle` variants, `--tracking-display/label/caps`, `--shell-max`. Utility classes (commit 71c88988): `text-fg-primary`, `bg-surface-base`, `bg-accent-warm`, `bg-status-positive`, `tracking-display`, `max-w-shell`.

New components should use the semantic tier. Existing components migrate as touched.

### Bitcoin Orange Rule

`--bitcoin-orange: #f7931a` (utility `bg-bitcoinOrange`) is **only for Bitcoin-related UI** — balances, Lightning indicators, Bitcoin icons. Never for general brand elements.

### Migration direction (x.ai-quality, Loki-aligned)

Multi-commit migration in progress:

- ✅ Semantic token tier added (eff99bad) + exposed via Tailwind utility classes (71c88988)
- ✅ Warm-accent Button variant; landing + auth + about + header CTAs all use `variant="accent"` (ff9f2ce5, 2cdb0907)
- ⏳ Drop chromatic brand palette (tiffany, orange) from new code; migrate existing classes to semantic tier (`bg-card → bg-surface-base`, `text-foreground → text-fg-primary`)
- ✅ Display typography: Space Grotesk (`font-heading`) for headings, IBM Plex Mono (`font-mono`) for code, Inter (`font-sans`) for body — self-hosted in `src/fonts/`, wired in `src/app/layout.tsx`
- ✅ Tailwind v4 (package on 4.x — this line previously claimed 3.3 long after main had moved, which misled agents; keep this table honest)
- ⏳ OKLCH color space for the token tier

End state: monochromatic surfaces + one warm accent (`#ff5c00`) for top-of-funnel conversion + Bitcoin Orange for Bitcoin-specific UI + status colors only for actual status. Everything else stays achromatic.

**Audit commands:**

```bash
# Find arbitrary hex violations in className props
grep -rn '\[#' src/
# Current count: 0 in className props (the two hits are regex literals in src/config/articles.ts)

# Find inline style hex violations
grep -rn "style={{.*#" src/
```

---

## Design discipline: one shape per kind

The rule is fleet-wide and stated once, in
[bitbaum/fleet AGENTS.md → "One shape per kind"](https://github.com/bitbaum/fleet/blob/main/AGENTS.md).
Read it before building any screen. What follows is this repo's instances
and gates — the owner wrote the rule's words about THESE screens (2026-10-21:
"Frankenstein elements … not aligned, look different, asymmetrical, with
labels that don't say anything"), and should never have to again.

**The reference implementation is the money surface** (`/receive`, `/send`,
`/requests`, `/pay/<username>`):

| Rule                                                     | Where it lives                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Siblings share one frame: title, one line, tabs, content | `src/components/money/MoneyPage.tsx` — no `icon` prop, on purpose              |
| Pick one of a few → equal cells in one row               | `src/components/ui/SegmentedControl.tsx`                                       |
| A few suggestions → an even grid                         | `AmountField` presets: `grid grid-cols-4`, four rungs                          |
| Two actions together → two equal cells                   | `ReceiveCode`: Copy link · Share in `grid-cols-2`                              |
| Rows of one list have one anatomy                        | `WaysToPay`, `OtherWaysToPay`, `RequestList`: name, detail, one action right   |
| Closed-until-wanted is a button that says so             | `src/components/money/OptionalNoteField.tsx` ("Add a note")                    |
| One primary action, monochrome in-app                    | `variant="primary"`; `variant="accent"` only on public, top-of-funnel surfaces |
| The icon promises the screen                             | the bottom bar's QR slot opens on a QR (`ReceiveCode`)                         |

**Gates** (all in `pnpm run verify`):

```bash
pnpm run check:choice-rows   # a wrapping box of choices (aria-pressed / radio / tab)
pnpm run check:accent-ink    # white text on the warm accent
pnpm run check:type-scale    # arbitrary font sizes
grep -rn '\[#' src/          # raw hex in a class
```

**Before you open a PR with a screen in it**, in this order, every time:

1. Open it at 390px. No sideways scroll; every target 44px; the committing
   action reachable without scrolling past what the person came for.
2. Put it beside its siblings. Same frame, same button variant, same row
   anatomy, same gap between cards.
3. Read every label aloud. Each says what happens when it is tapped.
4. Count the primary buttons. One.
5. Run the gates above.
6. Ask the owner's question yourself: is any element here a Frankenstein
   element? Fix it now, not after he says so.

---

## Shipping: nobody merges by hand

**Finished work ships without asking.** The owner steers by saying what to
build and checks the result on the live site; the owner does not read GitHub and
does not want to be asked about branches or PRs. So when the work they asked for is
done and verified, open a **non-draft** PR yourself, stay on it until it is
merged and deployed, and then give the owner the live URL to look at. Work that sits
on a branch never reaches anyone — that is how finished work used to go
missing. Ask the owner only about the product, never about git, and when you must
ask, offer options to pick rather than an open question.

**Do not merge PRs, and do not ask anyone to.** Open the PR and let the chain
below merge and deploy it:

```
push branch → open PR → CI green → auto-merge.yml squash-merges it
            → CI on main → CD deploys to bitbaum → health check
```

`.github/workflows/auto-merge.yml` calls the fleet's canonical sweep — the
policy no longer lives in this repo. It is defined once in
`bitbaum/fleet`, `scripts/ci/auto-merge-sweep.sh` (called as the reusable
workflow `bitbaum/fleet/.github/workflows/auto-merge-sweep.yml@main`), and a fix made to a
local copy here would reach nobody. The sweep merges **one** PR per sweep, and
only when: it is not a draft, carries no hold label, every check has finished
green, GitHub calls it cleanly mergeable, and main's own CI is currently green. One car per sweep is deliberate — a PR's
checks prove that PR against the main it branched from, not against the other
PRs queued beside it, so each merge is verified on main before the next couples.

**Signal "not ready" by opening a draft PR**, or by labelling it `hold` /
`no-automerge` / `do-not-merge` / `wip`. A draft waits forever. A red PR waits
until it is green. Neither needs a human.

Because of this, a green PR ships itself within minutes. Do not open a PR you
would not want deployed. If work needs to land in a specific order, keep the
later PRs as drafts until the earlier ones are on main.

**Two explicit hand-offs keep this chain alive. Never remove either.** Both
exist because `GITHUB_TOKEN` is deliberately inert (auto-merge.yml passes the
`FLEET_PAT` org secret to the sweep when it exists, but falls back to
`GITHUB_TOKEN`, so the chain must work without it):

1. **The CI re-arm** at the end of the canonical sweep (configured here via
   `rearm_workflows` in auto-merge.yml). A push made with the default
   `GITHUB_TOKEN` does not trigger workflows, so without the explicit
   `workflow_dispatch` a merge lands on main and CI never runs. The sweep also
   RECONCILES deployment directly (`deploy_workflow: cd.yml`): it compares
   main's tip against the last successful cd.yml run and dispatches cd.yml when
   they differ, so even if the whole chain below breaks, a merged commit is
   shipped by the next sweep rather than stranded.
2. **The `post-main` job** in `ci.yml`. GitHub also suppresses the `workflow_run`
   event for a run that was itself created with `GITHUB_TOKEN` — so the CI run
   the re-arm just started chains to _nothing_. Main Red Alert hangs off
   `workflow_run`, and `cd.yml` is `workflow_dispatch`-only, so neither runs on
   the automated path unless the dispatched run hands off itself. It does:
   file/close the red-main issue (`scripts/ci/main-red-alert.sh`), then
   dispatch CD with this run's ID and SHA (`scripts/ci/arm-cd.sh`), and fail
   if no CD run appears.

Failure mode if either is dropped: **CI is green, no check is red, and nothing
deploys.** On 2026-08-04 that stranded 14 verified commits on main for eight
hours. Auto-merge itself survived only because it has a `schedule` cron.

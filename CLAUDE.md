# OrangeCat

AI-native platform for universal economic and governance participation — "My Cat" AI agent enabling any identity to earn, fund, lend, invest, and govern freely with any currency.

FleetCrown (rebranded from Cockpit) is a live customer project (see "FleetCrown" and "OrangeCat" projects under Cato on this platform). Typed "customer" stakeholder edge + shared BTC wallet. Integration is real: FleetCrown production layer + OrangeCat economic layer. Changes here (e.g. stakeholder_relationships, project profiles) directly improve UX for FleetCrown (the customer) and all future customers.

@~/.claude/CLAUDE.md
@.claude/CLAUDE.md

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

2. **FleetCrown-aligned semantic tier** (migration target, added in commit eff99bad): `--text-primary/secondary/tertiary/muted/inverted`, `--surface-page/base/raised/overlay/modal/drawer/public`, `--border-default/interactive`, `--accent-primary/hover` (→ `#ff5c00`), `--status-positive/warning/negative/neutral` with `-subtle` variants, `--tracking-display/label/caps`, `--shell-max`. Utility classes (commit 71c88988): `text-fg-primary`, `bg-surface-base`, `bg-accent-warm`, `bg-status-positive`, `tracking-display`, `max-w-shell`.

New components should use the semantic tier. Existing components migrate as touched.

### Bitcoin Orange Rule

`--bitcoin-orange: #f7931a` (utility `bg-bitcoinOrange`) is **only for Bitcoin-related UI** — balances, Lightning indicators, Bitcoin icons. Never for general brand elements.

### Migration direction (x.ai-quality, FleetCrown-aligned)

Multi-commit migration in progress:

- ✅ Semantic token tier added (eff99bad) + exposed via Tailwind utility classes (71c88988)
- ✅ Warm-accent Button variant; landing + auth + about + header CTAs all use `variant="accent"` (ff9f2ce5, 2cdb0907)
- ⏳ Drop chromatic brand palette (tiffany, orange) from new code; migrate existing classes to semantic tier (`bg-card → bg-surface-base`, `text-foreground → text-fg-primary`)
- ⏳ Display typography (Space Grotesk for headings, IBM Plex Mono for code) replacing Inter-only
- ✅ Tailwind v4 (package on 4.x — this line previously claimed 3.3 long after main had moved, which misled agents; keep this table honest)
- ⏳ OKLCH color space for the token tier

End state: monochromatic surfaces + one warm accent (`#ff5c00`) for top-of-funnel conversion + Bitcoin Orange for Bitcoin-specific UI + status colors only for actual status. Everything else stays achromatic.

**Audit commands:**

```bash
# Find arbitrary hex violations in className props
grep -rn '\[#' src/
# Current count: 0 (clean)

# Find inline style hex violations
grep -rn "style={{.*#" src/
```

---

## Shipping: nobody merges by hand

**Do not merge PRs, and do not ask anyone to.** Open a PR and stop there —
merging and deploying are automated end to end:

```
push branch → open PR → CI green → auto-merge.yml squash-merges it
            → CI on main → CD deploys to bitbaum → health check
```

`.github/workflows/auto-merge.yml` calls the fleet's canonical sweep — the
policy no longer lives in this repo. It is defined once in
`bitbaum/dotfiles`, `scripts/ci/auto-merge-sweep.sh`, and a fix made to a
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
exist because `GITHUB_TOKEN` is deliberately inert:

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
   the re-arm just started chains to _nothing_. CD and Main Red Alert both hang
   off `workflow_run`, and both are therefore dead on the automated path unless
   the dispatched run hands off itself. It does: file/close the red-main issue,
   then dispatch CD, and fail if no CD run appears.

Failure mode if either is dropped: **CI is green, no check is red, and nothing
deploys.** On 2026-08-04 that stranded 14 verified commits on main for eight
hours. Auto-merge itself survived only because it has a `schedule` cron.

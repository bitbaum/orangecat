# Live rehearsal: the five bot demos on the live site

**What it is.** One Playwright spec, `tests/e2e/bots-rehearsal.live.spec.ts`,
that walks the live site as a brand-new person and proves the five bot demos
end to end: one door, the shelf and a real letter, a group with two
specialists in their lanes, hands (an event proposed, tapped, created), the
Loki connector asked twice, a routine set and stopped, and the API edges.
Every assertion carries the value it protects in a comment, so a red step
names what a person would lose.

**How it runs.** It mints its own pseudonymous account ("Start instantly") at
the start: no fixture secret, no shared history, nothing to clean up between
runs. It spends that account's free turns (about nine of the ten a day).

**When it runs.** When a person starts it, and only then. The _Live rehearsal_
workflow (`.github/workflows/live-rehearsal.yml`) is `workflow_dispatch` only;
it has no schedule and must not get one. A free-tier key is spent only when
someone asks (fleet rule 2026-09-25). The screenshots of every step are the
run's artifact, kept 14 days.

```bash
# by hand, from a checkout
E2E_BASE_URL=https://orangecat.ch pnpm exec playwright test \
  tests/e2e/bots-rehearsal.live.spec.ts --project=chromium --reporter=line
```

**What green means.** Each of the five demos ran on what is actually
deployed, with the free model chain, from a cold account. The launch gate in
ADR-0013 ("the five demos run every day on the live site") is this workflow,
run by a person each day of the rehearsal week.

**A deploy during a run.** The app restarts for a few seconds when main
deploys; an API call in that window answers 502. The spec retries such a call
once after five seconds and says so in the log. Two gateway errors in a row
are a real failure.

**What it does not prove.** Transcript quality beyond the named checks (a
specialist's exact wording), the routine's own run (it needs the person's own
key; the runner is covered by its unit tests), and anything in Loki beyond its
honest refusal for an unlinked account.

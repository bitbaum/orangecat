# One-Week Plan — 2026-07-13 → 2026-07-20

**Framing:** the 10-year vision is "economic participation as open as speech — any identity earns/funds/lends/invests/governs in any currency, with an AI agent doing the work." You cannot sprint a decade in a week. What you _can_ do in a week is **take the first irreversible step onto that path and prove the thesis once, with a real person.**

**The thesis in one sentence:** _an AI agent (the Cat) takes a real person from economic intent → a live, fundable economic object → actual money moving — without gatekeepers._ This week we make that true **once**, end-to-end, for one real user.

## North-Star metric for the week

**Payments processed: 0 → ≥ 1**, _and_ **≥ 1 real economic action by a real (Loki) user that the Cat helped create.** Not features shipped. One real loop.

Everything below serves that. If we hit the North Star and nothing else, the week is a success — because it converts the whole platform from "untested demo" to "load-bearing."

---

## Workstream A — First payment (the critical path; unblocks everything)

| #   | Action                                                                                            | Owner                 | Status     |
| --- | ------------------------------------------------------------------------------------------------- | --------------------- | ---------- |
| A1  | Provision `PLATFORM_NWC_URI` (Alby Hub connection) on the box — see `PLATFORM_WALLET_RUNBOOK.md`  | **Founder**           | ⬜ blocker |
| A2  | One live top-up test (min 1,000 sats) → balance credits = **first payment**                       | **Founder**           | ⬜         |
| A3  | Flip `CAT_CREDITS_LIVE = true` + deploy (small PR)                                                | Agent (on A2 confirm) | ⬜         |
| A4  | Confirm payment appears in ledger/history; add a simple "payments processed" counter we can watch | Agent                 | ⬜         |

**Why first:** ground truths #2 (state defines behavior) and #6 (correctness beats speed). A core verb that has never executed hides unknown-unknowns. A1 is a ~10-minute founder action and it is the gate to the entire value proposition.

## Workstream B — Harden before a real user touches it (parallel, agent)

Already shipped 2026-07-13: loan bugs, `show_on_profile` across all entities, **S1** (profile PII leak), **F2** (unpublish-on-partial-PUT), sats copy, form↔schema CI guard.

| #   | Action                                                                                        | Owner |
| --- | --------------------------------------------------------------------------------------------- | ----- |
| B1  | Add schema↔update-builder CI guard (F1 — prevents the next silent-drop)                       | Agent |
| B2  | Delete dead `database.generated.ts` (7,468 lines); gate/fix the voice test → green `npm test` | Agent |
| B3  | Verify S1 live on prod (view a profile, confirm no email/phone in the API response)           | Agent |

**Why:** a first real user hitting a PII leak or a silently-unpublished listing would poison the one thing that matters this week — trust in the first loop.

## Workstream C — Make the Cat _drive_ the loop (the 10-yr thesis, visible)

The Cat is capable but "lives alongside nav." This week, make **one full path** feel like the future: _talk to the Cat → it creates a live, fundable object → you can pay it._

| #   | Action                                                                                                                                                                          | Owner |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| C1  | Polish intent→entity→payable for 2–3 entity types (cause, project, product): "I want to fund/sell X" → Cat proposes prefilled card → 1 click → published + a working pay button | Agent |
| C2  | Make the Cat the _default_ surface on at least the dashboard entry (Cat-first, not a side panel)                                                                                | Agent |

**Why:** the moat is intelligence, not rails. This is the smallest visible proof that OrangeCat is an _AI economic agent_, not a form-based marketplace.

## Workstream D — Prove it with a real community (Loki)

| #   | Action                                                                                                                                    | Owner               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| D1  | Pick 1–3 Loki stakeholders; have each do **one** economic action on OC (top-up, or list something + get funded) with the Cat's help | **Founder** + Agent |
| D2  | Capture what broke / felt wrong — that becomes next week's list                                                                           | Agent               |

**Why:** 44 dormant accounts and 0 payments is the real starting state. One real user completing one real loop is worth more than any feature. Loki is the obvious first community because it already exists and is economically motivated.

---

## What we are deliberately NOT doing this week

- **Full fiat rails (Twint/PayPal).** Real, and the biggest gap to "any currency" — but a multi-week build. This week: a **half-day spike** to pick the first rail (Twint, Swiss-first) and write the integration plan, nothing more.
- **Investment settlement, live group/circle treasuries.** Real hollow spots, but they only matter _after_ payments work. Backlog.
- **The token-migration / god-file / status-config cleanup.** Bounded, non-urgent; do it opportunistically, not this week.

## Sequencing

- **Day 1:** A1 + A2 (founder) ∥ B1–B3 (agent). Unblock + harden.
- **Day 2:** A3 + A4. Ship "Live". Payments observably ≥ 1.
- **Days 3–4:** C1 (Cat drives the loop) ∥ Twint spike.
- **Day 4–5:** C2 + D1 (real Loki user does a real action).
- **Day 5:** D2 review → next-week plan.

## Definition of done (the week)

1. A real Lightning payment has settled on OrangeCat.
2. The Cat can take a person from spoken intent to a published, payable economic object in 2–3 entity types.
3. At least one real Loki user completed one real economic action.
4. No known PII leak, no silent-unpublish, `npm test` green.

If 1 + 3 are true, we're on the path. Everything after is compounding.

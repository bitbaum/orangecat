# Spec: Entity Detail Page Redesign

**Status**: Proposed
**Date**: 2026-06-29
**Problem owner**: founder (flagged the service detail page as "useless and ugly")

---

## 1. The problem (first principles)

A detail page exists for **one reason**: so a specific person can take a specific
action. Today our pages don't know who's looking or what they should do, so they
render a **debug dump of database columns**.

The service page the founder saw (the dashboard/owner view, `EntityDetailPage` →
`makeDefaultDetailFields`):

```
International Cooperation, Translation, or Research Service   ← breadcrumb crumb
International Cooperation, Translation, or Research Service   ← h1 (duplicated)
<AI-generated description>                                    ← subtitle
Status      active            Created   6/29/2026, 8:47:27 PM
Category    Translation        Updated  6/29/2026, 8:47:31 PM
Pricing     CHF 50.00/hour
Location    Remote
```

What's wrong, concretely:

| Issue                                             | Why it's wrong (ground truth)                                 |
| ------------------------------------------------- | ------------------------------------------------------------- |
| Title rendered twice (breadcrumb crumb + h1)      | Redundant; wastes the most valuable space                     |
| `Status: active` shown as a value                 | Internal state, not something a viewer acts on                |
| `Created` / `Updated` timestamps as primary facts | Meaningless to a buyer; they answer no question anyone has    |
| Flat `label → value` grid (Object.entries dump)   | A spreadsheet, not a page. No hierarchy, no story             |
| No provider / identity / trust                    | Who is Anja? Why trust her? Buried in prose                   |
| **No action.** Only "Edit" (owner)                | The page's entire purpose — let someone transact — is missing |
| Description = generic "Description" card          | Doesn't frame the offer or its value                          |

The founder's question — _"what exactly would a user do with it? how would they
act?"_ — has no answer on the current page. **That is the bug.**

## 2. The insight: intent is already in the taxonomy

We don't have to guess the action. The entity economic taxonomy (`AGENTS.md` → "What an entity is")
already defines what each entity is _for_ — so each has exactly one primary verb:

| Entity                     | Who lands here | The ONE action             |
| -------------------------- | -------------- | -------------------------- |
| service                    | a buyer        | **Book / Hire** → pay      |
| product                    | a buyer        | **Buy** → pay              |
| project / cause / research | a supporter    | **Fund**                   |
| event                      | an attendee    | **RSVP / Get ticket**      |
| loan                       | a lender       | **Review & lend**          |
| investment                 | an investor    | **Review & invest**        |
| asset                      | a renter/buyer | **Rent / Buy**             |
| ai_assistant               | a user         | **Chat**                   |
| group / circle             | a person       | **Join / Request to join** |
| wishlist                   | a giver        | **Gift an item**           |

So the primary action is a **property of the entity type**, and belongs in the
registry SSOT — not hardcoded per page.

## 3. The solution — one intent-driven detail experience

### Product lens — purpose per surface

There are two viewers of the same entity. They are **not** two pages; they are one
layout with a mode:

1. **Visitor (public)** — _understand → trust → act_. Sell the offer, establish the
   provider's credibility, and put the primary action one tap away.
2. **Owner (dashboard)** — _preview → manage → grow_. The owner should see **exactly
   what buyers see**, plus a management bar (Edit · Share · Status · Stats) and a
   "This is your live listing" framing. The current separate flat-dump view is
   **deleted** — it taught owners their listing looks like a database row.

### UX lens — information hierarchy (top → bottom)

```
┌────────────────────────────────────────────────────────────┐
│ [cover image OR type icon]   Service · Translation          │  ← context, not a badge soup
│ International Cooperation, Translation & Research            │  ← title ONCE
│ 👤 Anja Dräger · ex-diplomat · FR/EN  →profile              │  ← provider + 1-line credibility
│ CHF 50/hr · Remote · ~1 day response                        │  ← key facts as an inline strip
│ ┌──────────────────────────┐                                │
│ │  Book this service  ⚡    │  ← PRIMARY action, above fold │
│ └──────────────────────────┘     (sticky on mobile)         │
├────────────────────────────────────────────────────────────┤
│ About this service                                           │  ← description as a real section
│ <readable prose, the offer + what's included>                │
│                                                              │
│ What you get / How it works  (entity-specific slots)         │
│                                                              │
│ About Anja  — other listings, verification, languages        │  ← trust
└────────────────────────────────────────────────────────────┘
```

Rules:

- **Title once.** Breadcrumb's last crumb is muted/non-link or dropped.
- **No `Status:`/`Created`/`Updated` as content.** At most a subtle "Listed 29 Jun"
  line. Internal status drives availability, not a displayed field.
- **Facts are a designed strip**, not a label/value table — only the 3–5 facts a
  buyer actually weighs (price, location/delivery, duration, availability).
- Primary CTA is visible **above the fold** and sticky on mobile (the sticky bar
  already exists — wire it to the real verb, not a generic "Support").
- Empty/missing fields are **omitted**, never shown as "—".

### Engineering lens — SSOT / DRY / SoC

One system, config-driven. No per-entity page code, no Object.entries dumps.

1. **Extend the registry** with detail intent (the only new SSOT):
   ```ts
   // entity-registry.ts — per entity
   detail: {
     ctaLabel: 'Book this service',     // the economic verb
     descriptionTitle: 'About this service',
     ownerLabel: 'Provider',
   }
   ```
   `paymentPattern` (contribution vs fixed_price) already exists and selects the
   transaction flow.
2. **Per-entity `factStrip(entity)`** lives in that entity's config
   (`src/config/entity-configs/*`) — returns the 3–5 buyer-relevant facts. Replaces
   `makeDefaultDetailFields`'s blind column dump. SSOT for "what matters" per type.
3. **One detail layout** (`PublicEntityDetailPage` is 90% there). Owner view becomes
   `<PublicEntityDetailPage mode="owner" />` — same layout + a management bar slot.
   **Delete** `EntityDetailPage.makeDefaultDetailFields` and the dashboard's flat grid.
4. **Reuse** `PublicEntityPaymentSection` (already the transaction engine) for the CTA.
5. **Demote timestamps**: `PublicEntityTimestamps` → at most a one-line "Listed" in
   the provider area; remove from the primary column.
6. **SoC**: page = layout; registry = intent; entity config = facts; payment section
   = transaction. Adding a new entity still touches ~2 files.

Litmus: _"Can a new team member explain it in one sentence?"_ → "Every entity renders
through one intent-driven detail layout; what differs (CTA verb, facts, copy) comes
from the registry + that entity's config."

## 4. Rollout

1. **Quick wins (ship first, low risk):** drop the breadcrumb title-dup; remove
   `Status`/`Created`/`Updated` from the owner flat view; add the real primary CTA;
   surface the provider. Immediately makes the page answer "what do I do here?".
2. **Owner = public + management bar:** delete the flat dump; route owners to the
   real layout in `mode="owner"`.
3. **Fact strips + intent registry:** move per-type facts into config; add
   `meta.detail`.
4. **Polish:** trust block (other listings, verification), "Listed" line, empty-state
   omission, visual pass against the design tokens.

## 5. Acceptance

- A logged-out visitor on any entity sees: title once, provider + credibility, the
  3–5 facts that matter, and **one obvious primary action above the fold**.
- An owner sees their **live listing as buyers see it** + a manage bar — never a
  column dump.
- Zero `created_at`/`updated_at`/`Status:` rendered as primary content.
- Adding a new entity type requires no new detail-page code.

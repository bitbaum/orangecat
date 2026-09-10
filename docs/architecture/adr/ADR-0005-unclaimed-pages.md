# ADR-0005: Unclaimed Pages — Set It Up, Show It, Hand It Over

Date: 2026-09-07
Status: Accepted — implemented (#920 schema/domain/surfaces/share screen; Cat's verb and the access model below shipped 2026-09-10)
Supersedes: ADR-0004 D2 (materialise at claim) and D5 (not public until claimed)
Keeps: ADR-0004 D1, D3, D4, D6, D7, D8 and everything ADR-0003 protects

## Context

The ask, sharpened: _my friend needs money to set up an art studio. She has no
OrangeCat account. I should be able to create the studio's profile — and it
should say, plainly, that it is hers and not mine even though I set it up. Then
I invite her, she registers, and she takes control of what I already made._

ADR-0004 solved the handover but chose **nothing exists until she accepts**. That
is the right posture for a private gift and the wrong one for growth: a studio
that nobody can see cannot collect the friends, the interest, or the pressure
that make her want to claim it. The most successful version of this pattern in
the industry — the unclaimed business page ("Is this your business? Claim it.")
— works precisely because the page exists first and the claim comes second.

So the page comes first. The question this ADR answers is how to do that
without crossing the one line ADR-0003 draws:

> **Money must never be routable to an entity whose subject has not accepted
> it.**

## Decision

### D1 — The person exists as an actor from the start. Not a profile — an actor.

`profiles.id` is a validated FK to `auth.users(id)`; there is no profile before
an account, and that stays. But `public.actors` already carries `display_name`,
`avatar_url` and `slug` — everything a nameable, addressable identity needs and
nothing that can receive money. So a person set up on someone's behalf becomes:

```
actors: actor_type = 'unclaimed', display_name = 'Maria', slug = 'maria',
        claim_id → profile_claims(id), user_id = NULL, group_id = NULL
```

Her studio is then a real `projects` (or `groups`) row with `actor_id` pointing
at that placeholder — a real page with a real URL from minute one, **owned by
her**, never by the person who set it up.

This is the alternative ADR-0004 rejected as "elegant but risky". The risk was
that ~25 tables join `actors` and `actors.user_id` has no FK, so the money
guarantee would rest on convention. D3 below makes it structural instead, which
is the condition under which the rejection no longer applies.

### D2 — Claiming is one transaction: transfer, not materialise.

Because the rows exist, claiming does not create anything. It **moves
ownership**, atomically, in a single database function:

```sql
claim_placeholder_actor(p_claim_id uuid, p_claimer uuid)
  -- 1. find-or-create the claimer's own 'user' actor
  -- 2. for every column in the catalog that references actors(id):
  --      UPDATE <table> SET <col> = claimer_actor WHERE <col> = placeholder
  -- 3. fill the claimer's profile from the placeholder ONLY where blank (D6)
  -- 4. if placeholder.slug is a free, unreserved handle and the claimer has
  --    none: username := slug      ← the shared URL keeps working
  -- 5. DELETE the placeholder; mark the claim 'claimed'
```

Step 2 is driven by `information_schema` at run time, not by a hand-written
list: a table added next month is covered on the day it is added. The whole
thing is one transaction, so ADR-0004 D3's resume ledger becomes unnecessary
for this path — a transaction cannot half-succeed. (The at-claim materialiser
shipped in #909 is superseded by this and is removed in the same change; keeping
a second, weaker way to do the same thing is how a codebase grows two truths.)

Transfer was rejected in ADR-0004 because a half-transferred entity might have
received money under the wrong owner. That cannot happen here, because of D3.

### D3 — An unclaimed actor cannot receive money. Enforced by the database.

Three structural facts, none of them a rule someone has to remember:

1. **No profile, no Lightning address.** A placeholder has no `profiles` row, so
   `<username>@orangecat.ch` cannot resolve to it. Unchanged from ADR-0003.
2. **No wallet.** A trigger on `wallets` and `entity_wallets` refuses any insert
   whose owning entity's actor is `'unclaimed'`. A project set up for Maria has
   no wallet until Maria does.
3. **No payment initiation.** `can-receive` already answers "does this owner
   have somewhere to receive?" — for a placeholder the honest answer is no, and
   the Fund button says why: _"Maria hasn't accepted this yet."_

So the page exists, the page is visible, and the page cannot take a satoshi
until its subject has said yes. That is the invariant, intact, with the page
first.

### D4 — Visible, attributed, and not indexed until claimed.

Every page owned by an unclaimed actor renders a band that cannot be missed:

> **Set up by @george for Maria — Maria hasn't claimed this yet.**
> Is this you? **Take it over** · Not you? **Decline**

That band is the product. It answers the creator's requirement ("obviously
state that this is not for me"), it is the recipient's door in, and it turns
every visitor into someone who might nudge her. The Fund button is present and
disabled, with the reason, because an absent button reads as a broken page.

`noindex` until claimed. On-platform and by link, the page is public; to search
engines it does not exist until she has consented. That is the line between a
growth mechanic and putting a real person's name into Google without asking.

### D5 — The steward edits until the claim; then never again.

Whoever created the claim (`profile_claims.created_by`) can edit the placeholder
and everything it owns while the claim is pending — they are setting it up, and
a page nobody can fix is worse than none. `resolveCreationActor` and the
ownership checks gain one clause: _the user is the steward of this unclaimed
actor_. The moment the claim is accepted the placeholder is gone and the clause
matches nothing. The moment it is declined, D6 applies.

### D6 — Declining removes it. Entirely.

If Maria says no, her name comes down: the placeholder actor is deleted and
everything it owns goes with it. Nothing was funded (D3), so nothing is lost.
The steward is told. There is no "keep it but hide it" — a hidden page with a
real person's name on it is a liability with no product value.

One measured detail decides how this is written. Of the 25 foreign keys to
`actors(id)`, **15 cascade on delete and 10 `SET NULL`**. Deleting the actor
alone would therefore leave ten kinds of row alive with no owner — a project
with `actor_id = NULL` is an ownerless fundable thing, which is worse than the
page it replaced. So decline goes through the same catalog-driven function as
claim: it deletes every row that references the placeholder _first_, then the
placeholder. Same `information_schema` walk, opposite verb, one transaction.

Declining still requires no account (ADR-0004): the token is the capability.

### D7 — The URL survives the claim.

`/profiles/<slug>` resolves through `actors.slug` when no `profiles.username`
matches. On claim, the slug becomes her username if it is free and unreserved
(the same `RESERVED_USERNAMES` gate that was bypassed in defect #3 — it is
consulted here explicitly). The link her friends shared last week is the link
that works after she signs up. The studio's own URL never changed at all.

### D8 — Delivery is the feature, not the afterthought.

ADR-0004 D7 said link-first and then did not build it. The moment the studio
exists, the creator sees ONE screen: the live page, a copy button, a prewritten
message, and one-tap targets — WhatsApp, Signal, email, copy. Nothing else on
that screen. The dashboard keeps the funnel (_Not sent → Sent → Opened →
Claimed / Declined_) so the creator knows whether to nudge, but the share screen
is where the handoff actually happens, and it is the difference between a link
sent today and a link meant to be sent this week.

## The experience, end to end

**George** — three screens, no new concepts:

1. Create → Project → the ordinary form. At the top: _This is for:_ **Me ▾** →
   **Someone else…** → "Maria". Shipped in #911; only what happens on submit
   changes.
2. Done. The studio page is live. Copy the link, or tap WhatsApp. The message
   is already written: _"Hoi Maria — I set up a page for your studio. It's
   yours, one tap: <link>"_
3. Later: **Set up for others** shows _Sent → Opened_ — or _Declined_, which is
   its own answer.

**A visitor** sees a real studio page with the band. Cannot fund it. Can share
it, can tell Maria.

**Maria** taps the link and sees **her studio**, not a form. One button: _Take
it over_ → sign up (or log in) → the same page, now hers, with a wallet she can
attach. Or _Not me_ — gone, no account needed.

**Cat**: _"my friend Maria wants to open an art studio in Basel"_ → the same
primitive, a confirmation card, then the share screen.

## What this costs

- One migration: `actor_type` gains `'unclaimed'`, `actors.claim_id`, the
  wallet guard trigger, the transfer function, `profile_claims.actor_id`.
- The at-claim materialiser (#909) and `draft.entities[]` are removed; the
  claim row remains as the consent and delivery record.
- The band, the disabled Fund state, the `/profiles/<slug>` fallback, the share
  screen.
- RLS: unclaimed actors and their entities are readable; writable only by the
  steward while pending.

## Alternatives considered

**Keep ADR-0004 as shipped — nothing exists until claimed.** Correct, private,
and invisible. It cannot grow, and the creator's requirement — that the page
exists and says whose it is — is unmet by definition.

**The steward owns it, with a "held for" pointer; transfer on claim.** Works,
but the page is then _George's_ page with a note, which is exactly what the ask
rules out, and money can land in George's wallet before Maria says yes unless
funding is blocked — at which point one may as well have the placeholder own
it outright.

**Make it public AND fundable, escrow the money.** The strongest growth story
and the one ADR-0003 forbids for good reason: money held for a person who has
not agreed to anything is a custody obligation, a refund path, and a
regulatory question, all for a person who may click _Decline_.

## Implementation order

1. **Schema + transfer function**, validated against the live box inside a
   rolled-back transaction as before.
2. **Domain**: create-for-someone-else builds the placeholder and its rows;
   claim calls the function; decline deletes. Remove the materialiser.
3. **Surfaces**: the band, disabled Fund, profile-slug fallback, `noindex`.
4. **The share screen** (D8) — the one that makes the rest matter.
5. Cat's verb.

## Addendum 2026-09-10 — Cat's verb, and who has access when

Built after watching the first real attempt: George sat with Annushka (no
account, Russian-speaking, non-technical) and described her idea to Cat. Cat
re-offered the same three drafts three times, attributed George's own skills
to her, leaked a raw tool-call object into the reply, and never recognised
"this is for another person who isn't registered" as the cue. Nothing was
created. What changed:

- **`create_project_for_person`** — one registry action does what the create
  form's "This is for: someone else" does: placeholder actor, project owned by
  it, and the share link back to the steward. Confirmation card states whose
  it is and that no money moves until she accepts. `send_to_fleetcrown`
  mints the same signed handoff as the entity page's card, so "can she have it
  built?" is answered with a link.
- **Denied is now asked.** A category the user never granted (entities is off
  by default — it was off for George, which is why Cat could only ever draft)
  produces the confirmation card with one extra sentence and an "Allow and
  confirm" button, instead of a dead end plus a settings link. Payments and
  high-risk actions are excluded from that shortcut.
- **Reply language.** Cyrillic is detected as a script; the "unknown" branch no
  longer ends with "if the user wrote English, reply in English"; and a
  non-Latin sentence now reaches the tool phase at all.

**Access, decided.** While the claim is pending the steward manages the page
(D5) — the band says so: "Until then, @george keeps it up to date." On claim,
the owner has full access and the steward's ends; a co-editor model does not
exist for projects and is not invented here. What stays is attribution:
`projects.user_id` is the creating account and differs from the owner exactly
when the page was set up on someone's behalf, so the page renders "Set up by
@george, now run by its owner" for as long as it exists. Ownership on the page
resolves through the actor, not `user_id` — which had shown the steward as
owner after a claim and hidden the controls from the person it belonged to.

**FleetCrown gets the client.** The handoff token now carries `owner`
(kind/displayName/pageUrl/stewardUsername); FleetCrown writes it into the
project notes and profile (`owner`, `url`, `customers`, `status`, `next_step`)
and the steward may hand an unclaimed page over. Only the owner could before —
and for a placeholder the owner is nobody, so the button 403'd.

**Walked in prod 2026-09-10/11 (#958, #960).** The walk found and fixed: the
API rail's project was owned by the steward (five domain services dropped
`_resolved_actor_id`); unclaimed actors were invisible under the `actors`
SELECT policy (no band, no slug page, handoff naming the steward as client); a
claim kept a minted `user_<hex>` handle instead of the slug; a pending
confirmation rendered as "Action failed"; the share link never reached the
chat after confirming.

**Still not built:** services, products and groups for someone else
(`CLAIMABLE_ENTITY_TYPES` is `['project']`); a co-editor model so a steward can
keep helping after the claim. The free model invents a funding goal unless the
parameter text forbids it (it does now); a frontier model would not.

## Related

- [ADR-0003](ADR-0003-site-factory-and-unclaimed-entities.md) — the invariant.
- [ADR-0004](ADR-0004-handing-over-the-keys.md) — the claim primitive, the
  token, consent, and the create-form control this builds on.

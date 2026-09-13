# ADR-0003: The Site Factory, and Entities Nobody Has Claimed Yet

Date: 2026-08-27
Status: Proposed

## Context

The studio wants to prospect at volume: find a business with a bad website,
build a better one unasked, and hand it over along with an OrangeCat presence
that can raise. `camille.orangecat.ch` is that pitch built once by hand, and
`substrata.orangecat.ch` is the same product with its content expressed as data.

Three things about the existing code decide most of this:

1. **`substrata/config/site-content.ts` already models a site as data** — a
   closed union of section kinds (`hero`, `prose`, `stats`, `cards`,
   `definitions`, `index`, `table`, `meter`), pages as config, one catch-all
   route. `camille-boulangerie` is the same product hand-rolled as `.tsx`.
2. **`public.profile_claims` already models a draft that is not yet a person.**
   `profiles.id` is a validated FK to `auth.users(id)`, so a profile *cannot*
   exist before its subject has an account. The claims table is the holding area:
   the row id is the claim token, there are no RLS policies at all, and every
   read goes through a server route on the service-role client.
3. `integration_keys` / `webhook_endpoints` already carry Loki's calls.

## Problem Statement

Two questions, and they have different answers.

**Where does the pipeline live?** It touches site generation, prospect
tracking, and a fundable entity. Putting all of it in one repo puts prospecting
code inside the money boundary, or money code inside a CRM.

**How does an entity exist before its subject agrees to it?** A pitch needs a
profile with projects that can raise — but the business has not consented, has
no account, and may say no. `profile_claims` answers this for a *person*
(name, bio, avatar, links). It has no notion of a business, a group, or
anything that can receive funds.

## Decision

Three layers, split on the boundary that already exists.

**1. `sitekit` — a shared package, extracted from Substrata.** The section-shape
schema, the renderers, and a `siteFromUrl()` extractor. Not in this repo.

The reason this is the whole efficiency argument: the generator emits **data
against a closed schema**, never `.tsx` against nothing. A model filling eight
known section kinds is a task with a machine-checkable result; a model writing
components is not. Per-site quality then becomes a property of the renderers —
fixing the `cards` renderer improves every site ever generated. It ships no
design tokens: each site keeps its own `globals.css`, because the system is
uniform and the aesthetics are not.

**2. Loki — the prospect pipeline.** Scrape, assess, generate, pitch,
hand over. Loki already models exactly this shape (projects, crew
assignments, agent runs, activity). A prospect is a project that has not said
yes yet. It calls OrangeCat; it does not own the entity.

**3. OrangeCat — the claimable entity.** Two changes here:

- **Generalise `profile_claims` into entity claims.** Same primitive, same
  id-is-the-token design, same service-role-only posture. The `draft` jsonb
  grows a discriminated `kind`, so a draft can describe a group and the projects
  under it, not only a person.
- **Add an ingest door**: `POST /api/claims/ingest` taking `{ url }` or
  `{ text }`, extracting via Cat, and writing **one pending claim**. The same
  endpoint serves Loki's pipeline and a human typing a sentence to Cat —
  deliberately, so the pipeline gets no privileged path a person cannot use.

## Rationale

- **Blast radius.** Claim tokens, identity and fundraising sit on one side of a
  network boundary. Prospecting code cannot widen them by accident because it
  cannot reach the tables.
- **SSOT.** There is one definition of "an entity that can raise" and it is
  this repo's. A second one inside a CRM would be a second source of truth about
  money.
- **The 2-files test.** A new section kind touches `sitekit` only. A new
  prospect state touches Loki only. A new claimable kind touches this repo
  only.

## The invariant this exists to protect

**Money must never be routable to an entity whose subject has not accepted it.**

The architecture gives this for free, on one condition: **ingest writes to the
claims table and never to `profiles`.** A pending claim has no `auth.users` row
behind it, therefore no wallet, no Lightning address, no way to receive. That is
a structural guarantee, not a policy someone has to remember — and it is the one
line in this design that must not be crossed for convenience.

Two supporting rules, from `camille-boulangerie/HANDOVER.md`, which rehearsed
this end to end on 2026-08-27 and found (§4) that its scraped-and-pseudonymised
content **cannot be handed to a client** — it would be a restyled copy of a
competitor's copy:

- **Pseudonymisation is a portfolio device, not a safety device.** Fully
  fictional demos (Camille) are safe to publish because nobody is represented.
  A pitch aimed at a real business uses that business's **real** name, on our
  subdomain, `noindex`, carrying the `DemoBanner` that says it is an unsolicited
  mockup by the studio, with takedown on request and no negotiation. A near-miss
  name reads as either a mistake or a knock-off, and it makes the artifact
  undeliverable.
- **Fabricate no facts** — not the address, hours, prices, or reviews. A
  plausible-but-wrong street number is the single detail that actively damages
  the business the pitch is meant to win, and every invented field has to be
  found and rewritten before handover anyway. Use what is public and leave the
  rest empty. Empty fields are themselves the pitch: this is what we could not
  find out about you in five minutes, which is what your customers also cannot
  find.

## Consequences

- One migration here (claims `draft` gains a discriminated kind) and one new
  route. The claims table's no-RLS, service-role-only posture is inherited
  deliberately; do not add a permissive policy to make the pipeline simpler.
- Substrata and Camille both become `sitekit` consumers, which is how the schema
  gets tested before it is pointed at strangers.
- A prospect that is never claimed expires on the existing 180-day clock and
  costs nothing.

## Implementation order

1. Extract `sitekit` from Substrata and **rebuild Camille on it**. That rebuild
   is the schema's test: if Camille cannot be expressed in the closed union, the
   union is wrong, and it is cheaper to learn that on a site we own.
2. Ingest endpoint here, person drafts only — the existing shape, a new door.
3. Walk **one** real prospect through the whole chain by hand, with no pipeline.
4. Only then give Loki a prospect table, and only the states step 3 proved
   exist.

Steps 1 and 2 are independent. Step 4 is the one to resist starting early: a
pipeline built before a single sale encodes guesses that a real conversation
will contradict.

## Alternatives Considered

**All of it in Loki.** Rejected: it puts a second definition of a fundable
entity next to a CRM, and moves the pre-claim funding invariant from a
structural guarantee to a rule someone has to keep remembering.

**All of it here.** Rejected: prospect tracking is not an economic primitive, and
Loki already has the pipeline shape. This repo would grow a CRM.

**Skip `sitekit`; let the generator write components.** Rejected: it makes output
quality unverifiable per site and unimprovable across sites, which is the whole
point of doing this at volume.

**Pre-create real `profiles` rows for prospects.** Rejected, and impossible
anyway — `profiles.id` is a validated FK to `auth.users(id)`. The constraint is
doing exactly its job.

## Related Documents

- `supabase/migrations/20260818130000_profile_claims.sql`
- `substrata/config/site-content.ts`
- `camille-boulangerie/HANDOVER.md`
- [ADR-0001: My Cat Conversational Entry Layer](ADR-0001-my-cat-conversational-entry.md)

# ADR-0003: The Site Factory, and Entities Nobody Has Claimed Yet

Date: 2026-08-27
Amended: 2026-08-28
Status: Proposed

> **Amendment, 2026-08-28.** The original decision made the OrangeCat claim the
> spine of the pitch: a prospect received a profile and claimed it. That puts a
> Bitcoin wallet in the critical path of selling a bakery a website, and most
> bakers have no idea what any of it is. Corrected below — **the proposal is the
> primary artifact, the website is the product and the magic moment, OrangeCat
> (economy) is an opt-in add-on offered only after a yes, and Solon (governance)
> is not offered at all yet.** The pitch must also not read as a website used as
> bait for a crypto onboarding — see "What the pitch must not imply", which makes
> that structural rather than a promise. Adds the **self-serve door** (paste your
> own URL and watch it build), which is safer than outbound because the subject
> initiated it. Also corrected: the claim flow the original described as future
> work already ships.

## Context

The studio wants to prospect at volume: find a business with a bad website,
build a better one unasked, and offer it. `camille.orangecat.ch` is that pitch
built once by hand, and `substrata.orangecat.ch` is the same product with its
content expressed as data.

Four things about the existing code decide most of this:

1. **`substrata/config/site-content.ts` already models a site as data** — a
   closed union of section kinds (`hero`, `prose`, `stats`, `cards`,
   `definitions`, `index`, `table`, `meter`), pages as config, one catch-all
   route. `camille-boulangerie` is the same product hand-rolled as `.tsx`.
2. **`public.profile_claims` already models a draft that is not yet a person.**
   `profiles.id` is a validated FK to `auth.users(id)`, so a profile *cannot*
   exist before its subject has an account. The claims table is the holding area:
   the row id is the claim token, there are no RLS policies at all, and every
   read goes through a server route on the service-role client.
3. **The claim flow is built, not hypothetical.** `/claim/[id]` renders the draft
   under `noindex`; `claimProfileClaim` does a compare-and-swap on
   `status = 'pending'` so two tabs cannot both win, resolves username collisions
   via `findAvailableUsername`, copies the draft onto the caller's own profile,
   and rolls the claim back to `pending` if that copy fails. Revoke and a
   180-day expiry exist. What is missing is only the door in front of it.
4. `integration_keys` / `webhook_endpoints` already carry FleetCrown's calls.

And one fact about the stack: OrangeCat is the **economy** pillar, FleetCrown the
**engineering** one, and Solon the **governance** one — early, and not ready to
be sold to anyone. A prospect is being sold a website. The pillars are what they
may *later* want, at most.

## Problem Statement

Three questions, and they have different answers.

**What does the prospect actually decide?** Someone who has never heard of us
opens one link. They must understand the offer, want it, and be able to say yes
or no in a single click. Anything they have to learn first is a leak.

**Where does the pipeline live?** It touches site generation, prospect tracking,
and a fundable entity. Putting all of it in one repo puts prospecting code inside
the money boundary, or money code inside a CRM.

**How does an entity exist before its subject agrees to it?** A profile that can
raise needs an account the business has not created. `profile_claims` answers
this for a *person* (name, bio, avatar, links). It has no notion of a business,
a group, or anything that can receive funds.

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

**2. FleetCrown — the pipeline and the proposal.** Scrape, assess, generate,
propose, hand over. FleetCrown already models this shape (projects, crew
assignments, agent runs, activity). A prospect is a project that has not said yes
yet.

**The proposal is FleetCrown's object, and it is deliberately not behind
OrangeCat auth** — requiring an account to *read an offer* is the leak this
amendment exists to close. It carries its own token, and accept/decline needs no
login.

**3. OrangeCat — the economy add-on (opt-in).** Unchanged mechanically, demoted
in the funnel. Two changes here:

- **Generalise `profile_claims` into entity claims.** Same primitive, same
  id-is-the-token design, same service-role-only posture. The `draft` jsonb
  grows a discriminated `kind`, so a draft can describe a group and the projects
  under it, not only a person.
- **Add an ingest door**: `POST /api/claims/ingest` taking `{ url }` or
  `{ text }`, extracting via Cat, and writing **one pending claim**. The same
  endpoint serves FleetCrown's pipeline and a human typing a sentence to Cat —
  deliberately, so the pipeline gets no privileged path a person cannot use.

**Not a fourth layer: Solon.** Governance is the direction this eventually
heads — a Verein or co-op that runs its own votes is a real end state. But the
product is at an early stage and is not ready to be sold to a stranger, so it
gets **no place in this pipeline at all** for now: not a layer, not an add-on,
not a sentence in a proposal. Build toward it; offer nothing.

## Two doors

The same machine, entered two ways, and they have **different consent postures**.

**1. Outbound — we reach out.** We pick the business, build the site unasked, and
send a link with a package and a price. Everything in "What the pitch must not
imply" and the pseudonymisation rules below exists for this door: it is the one
where a stranger is represented without having asked.

**2. Self-serve — they paste their own URL** and watch their site get rebuilt.
This door is strictly safer, and it should be the one we push. The subject
initiated it, so consent is not a question: no unsolicited artifact, no takedown
negotiation, no claim row, no `DemoBanner` explaining why we made something about
them. It is also the better business — inbound intent beats cold outreach, and it
scales without us choosing targets one at a time.

Its own risk is the mirror image: **anyone can paste anyone's URL.** So self-serve
output is **ephemeral and unpublished by default** — a temporary preview under
`noindex`, no permanent subdomain, no claim row, expiring on its own. Pasting a
competitor's URL then produces nothing shareable and nothing that damages them.
Publishing requires the same yes as the outbound door.

Generation costs model tokens and hits someone else's server, so the public door
is rate limited per IP with [`limitkit`](https://github.com/catomean/limitkit),
which FleetCrown already runs as its proving consumer. A free lead magnet with an
uncapped spend is not a lead magnet.

## The proposal

The artifact a stranger opens. It has to survive being read by someone who has
never heard of the studio, in under a minute.

**The website is the magic moment** — the second someone sees their own business
looking good. Everything else in the proposal exists to get them there faster or
to explain what they just saw. So the site comes first, above the fold, before
any account of who we are. Nobody is moved by an introduction; they are moved by
their own shop, rendered well.

- **The live site, at a real URL.** Not a screenshot, not a PDF. `noindex`,
  carrying the `DemoBanner` that says it is an unsolicited mockup by the studio.
- **Before and after, side by side.** This is the entire emotional argument and
  it needs no words.
- **What is wrong with the current one, measured.** Not adjectives — the load
  time, the contrast failures, the missing phone link, no HTTPS, unusable on a
  phone. `dotfiles/scripts/ci/ui-defect-audit.mjs` already renders live sites and
  finds AA contrast failures and misaligned stacks; the assessment step is that
  tool pointed outward.
- **What we could not find out about you.** The empty fields, shown as empty.
  This is the strongest paragraph in the document: what we could not learn about
  you in five minutes is what your customers also cannot.
- **Price, and what happens on yes.**
- **Two buttons: Accept, and Not interested.**

**"Not interested" must be one click and must actually work** — it takes the site
down, with no counter-offer and no follow-up. That is what makes it defensible to
send something unsolicited at all.

Proposal states: `draft → sent → viewed → accepted | declined | expired`.
`viewed` is the only interesting commercial signal. `declined` and `expired` both
tear the site down and revoke any attached claim.

**On yes, the deliverable is the website** — the repo, or hosting it on their
domain. Nothing about Bitcoin has been mentioned yet. Only then, as a separate
sentence: *you can also have a public profile that accepts payments.* If that
lands, the claim link from layer 3 is the door, and it is the same flow that
already ships.

## What the pitch must not imply

**It must not look like the website is bait for a crypto onboarding.** This is a
trust constraint, not a tone preference. A stranger who suspects the real ask is
somewhere further down stops evaluating the site on its merits — and the site is
the only thing here with self-evident value. The suspicion does not cost us the
upsell; it costs us the sale.

Three rules follow, and the third is the one that actually settles it:

- **No Bitcoin, wallet, crypto or token vocabulary anywhere in first contact.**
  Not in the proposal, not in the site, not in the email. It is not a secret —
  it is simply not what is being offered yet.
- **The proposal is not an account signup.** No registration wall, no OrangeCat
  chrome, nothing to join in order to read an offer or decline it.
- **The website must be deliverable in full with zero OrangeCat dependency.**
  They can take the code, host it wherever they like, and never speak to us
  again. Keeping that true is what makes "this is not a funnel" demonstrable
  instead of asserted — and it is the reason `sitekit` ships no coupling to this
  repo. If handover ever starts requiring an account, the claim is false and
  people will be right to suspect it.

Bitcoin onboarding remains a genuinely good outcome. It is earned by having
already done something valuable for someone, which is also the only condition
under which the pitch for it is any good.

## The build is the show

Generation is not instant, and hiding it behind a spinner wastes the best part.
**Stream it**: the page being fetched, the sections recognised, the site
assembling. Watching your own shop turn into a good website in front of you *is*
the wow moment — a reveal after thirty silent seconds is a worse version of the
same thirty seconds.

It is also the honest place to show what was found and what was not, which is
where the empty-fields paragraph earns its credibility instead of reading as an
excuse.

## Built to the standard we hold the fleet to

"Good design and best practices" is not a promise the generator can make; it has
to be a property of what it emits, checkable by the machinery that already
polices this fleet:

- **The generated repo ships the golden CI** from `dotfiles/templates/ci/` and a
  real `verify` — lint, typecheck, test. It passes `verify-floor-audit.sh` on the
  same terms as any repo we own. A site we hand over is a repo we would accept.
- **Token architecture, not token values.** It inherits the *shape* of
  `@fleet/design-tokens` — the knobs block, the primitive/semantic tiers, Tailwind
  referencing CSS vars and never literals — so a retheme is one file. It must
  **not** import the fleet's values: those make things look like OrangeCat, and a
  bakery has to look like itself. Uniform system, divergent aesthetics.
- **Before/after is two audit runs, not two adjectives.**
  `dotfiles/scripts/ci/ui-defect-audit.mjs` renders live sites and finds AA
  contrast failures and misaligned stacks. Run it on their current site and on
  ours. The improvement becomes a measurement the prospect can check, and the new
  site's score is held there by CI rather than by whoever reviewed it.

This is the part that makes volume safe. Doing a hundred of these only works if
quality is enforced by the same gates as everything else we ship — otherwise the
hundredth site is the first one nobody looked at.

## Rationale

- **The offer must be legible to someone who knows nothing.** A better website is
  self-evidently valuable to a baker. A Bitcoin-native economic profile is not,
  and putting it first means the conversion rate of the website business is
  capped by the hardest concept in the stack.
- **Onboarding is the upside, not the entry fee.** Every accepted site is a
  warm relationship with a real business — a far better position from which to
  introduce OrangeCat than a cold link ever was. Making it optional is what makes
  it *possible*.
- **Blast radius.** Claim tokens, identity and fundraising sit on one side of a
  network boundary. Prospecting code cannot widen them by accident because it
  cannot reach the tables.
- **SSOT.** There is one definition of "an entity that can raise" and it is this
  repo's. A second one inside a CRM would be a second source of truth about money.
- **The 2-files test.** A new section kind touches `sitekit` only. A new prospect
  state touches FleetCrown only. A new claimable kind touches this repo only.

## The invariant this exists to protect

**Money must never be routable to an entity whose subject has not accepted it.**

The architecture gives this for free, on one condition: **ingest writes to the
claims table and never to `profiles`.** A pending claim has no `auth.users` row
behind it, therefore no wallet, no Lightning address, no way to receive. That is
a structural guarantee, not a policy someone has to remember — and it is the one
line in this design that must not be crossed for convenience.

Making OrangeCat opt-in **strengthens** this: most prospects now never get a
claim row at all, so the invariant holds vacuously for the majority rather than
resting on pipeline discipline.

Two supporting rules, from `camille-boulangerie/HANDOVER.md`, which rehearsed
this end to end on 2026-08-27 and found (§4) that its scraped-and-pseudonymised
content **cannot be handed to a client** — it would be a restyled copy of a
competitor's copy:

- **Pseudonymisation is a portfolio device, not a safety device.** Fully
  fictional demos (Camille) are safe to publish because nobody is represented.
  A pitch aimed at a real business uses that business's **real** name, on our
  subdomain, `noindex`, carrying the `DemoBanner`, with takedown on request and
  no negotiation. A near-miss name reads as either a mistake or a knock-off, and
  it makes the artifact undeliverable.
- **Fabricate no facts** — not the address, hours, prices, or reviews. A
  plausible-but-wrong street number is the single detail that actively damages
  the business the pitch is meant to win.

**Make that second rule checkable rather than remembered.** A closed schema
invites completion: a model handed a `stats` section wants numbers in it. So
`sitekit` distinguishes **unknown** from **empty**, and every generated field
carries its provenance — source URL, or `inferred`. No field may ship with
`inferred` provenance in a real pitch. That turns "we invented nothing" from a
promise into an assertion, and it is what makes the empty-fields paragraph above
honest.

## Consequences

- One migration here (claims `draft` gains a discriminated kind) and one new
  route. The claims table's no-RLS, service-role-only posture is inherited
  deliberately; do not add a permissive policy to make the pipeline simpler.
- FleetCrown grows a proposal object with its own token and public read. It must
  not reach into this repo's tables to render one.
- Substrata and Camille both become `sitekit` consumers, which is how the schema
  gets tested before it is pointed at strangers.
- A prospect that is never claimed expires on the existing 180-day clock and
  costs nothing.
- Conversion is now measurable in two independent steps — site accepted, and
  profile claimed. Collapsing them would have hidden which one is failing.
- The self-serve door is an **unauthenticated endpoint that fetches arbitrary
  URLs and spends model tokens**. It needs the rate limit, a spend cap, and a
  refusal path for URLs that should not be fetched, from its first day rather
  than after the first bill.
- Generated repos become fleet repos for auditing purposes: they show up in
  `verify-floor-audit.sh` and the shared-inventory ratchet. That is intended —
  it is what keeps site number one hundred as good as site number one.

## Implementation order

1. Extract `sitekit` from Substrata and **rebuild Camille on it**. That rebuild
   is the schema's test: if Camille cannot be expressed in the closed union, the
   union is wrong, and it is cheaper to learn that on a site we own.
2. Build the proposal page in FleetCrown — before/after, measured defects,
   accept/decline. This is the artifact that decides whether any of it sells.
3. Walk **one** real prospect through the whole chain by hand, with no pipeline
   and no OrangeCat offer at all. Sell a website.
4. Open the **self-serve door** — paste a URL, watch it build, ephemeral and rate
   limited. It is the safest way to exercise the generator at volume, because
   every subject asked for it, and it is the only step that produces inbound
   demand instead of consuming our attention per target.
5. Only then offer the profile to a business that already said yes.
6. Only then give FleetCrown a prospect table, and only the states step 3 proved
   exist.

Steps 1 and 2 are independent. The ingest endpoint here is not on the critical
path any more and can wait for step 5. Step 6 is the one to resist starting
early: a pipeline built before a single sale encodes guesses that a real
conversation will contradict.

**Solon appears nowhere in this list, deliberately.** Nothing above should be
shaped by it, and no step should be made harder to accommodate a governance
layer that is not ready. When it is, it will be a new conversation with
businesses we already have a relationship with — which costs nothing to keep
possible and nothing to defer.

## Alternatives Considered

**Make the OrangeCat profile mandatory** — the original decision here. Rejected:
it requires a stranger to understand a Bitcoin-native economic layer before they
can accept a website, and it makes an unsolicited pitch look like an account
signup, which is what unsolicited pitches usually are.

**Offer Solon to member-run organisations.** Rejected for now, at any point in
the funnel — not only first contact. It is the most abstract product in the
stack and it is not finished. Selling an unready governance layer to a Verein
that trusted us over a website would cost more than it earns. Revisit when the
product is ready to stand on its own.

**All of it in FleetCrown.** Rejected: it puts a second definition of a fundable
entity next to a CRM, and moves the pre-claim funding invariant from a structural
guarantee to a rule someone has to keep remembering.

**All of it here.** Rejected: prospect tracking is not an economic primitive, and
FleetCrown already has the pipeline shape. This repo would grow a CRM.

**Skip `sitekit`; let the generator write components.** Rejected: it makes output
quality unverifiable per site and unimprovable across sites, which is the whole
point of doing this at volume.

**Pre-create real `profiles` rows for prospects.** Rejected, and impossible
anyway — `profiles.id` is a validated FK to `auth.users(id)`. The constraint is
doing exactly its job.

## Related Documents

- `supabase/migrations/20260818130000_profile_claims.sql`
- `src/domain/profileClaims/service.ts`, `src/app/claim/[id]/page.tsx`
- `substrata/config/site-content.ts`
- `camille-boulangerie/HANDOVER.md`
- [ADR-0001: My Cat Conversational Entry Layer](ADR-0001-my-cat-conversational-entry.md)

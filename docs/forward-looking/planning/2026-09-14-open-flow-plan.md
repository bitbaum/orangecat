---
created_date: 2026-09-14
last_modified_date: 2026-09-14
last_modified_summary: First version — synthesis of the founder's 2026-09-14 direction into workstreams, with what shipped the same day and what is decided, next, later, or not done.
---

# Open flow — plan of 2026-09-14

What the founder said this morning, made into work. Written so it can be
read in five minutes and acted on without the conversation it came from.

## 1. What was said, in six threads

1. **Philosophy.** OrangeCat is as open as it can be. Any model — closed,
   open-weight, American, European, self-trained — and for each situation a
   different one may win. We are enablers: we facilitate the flow of energy
   between people, in the form of knowledge, effort, and value.
2. **Value.** Value is measured sometimes in universal things, sometimes not.
   What is valuable to one person is not to another. _What is the most
   valuable?_ was put to us as a question (§3).
3. **Names.** Is there a coin name? Research `ocoin`, `orangecoin`,
   `catcoin`, `occoin` and friends, preferably `.com` — and build the
   capability to do that research inside OrangeCat, not at Infomaniak or
   Namecheap. Eventually, maybe, be the registrar/broker ourselves.
4. **The domain business.** Every site gets `<name>.orangecat.ch` free. When
   someone moves to their own domain (synctattoo.com), the founder paid the
   CHF 10/year out of pocket. That is what should be charged: the vendor's
   cost, recurring, passed through.
5. **Identity.** Domains are one case of a broader thing: online identity and
   reputation management. Build the infrastructure for it across OrangeCat,
   Loki (production) and Solon (governance), developed together.
6. **Substrate.** What matters most under the UI is the database, the data
   and its analysis, model swapability, the power of the models, and access
   to compute — and to whatever resources give us more compute.

## 2. The principles this fixes

- **Enabler, not gatekeeper.** OrangeCat adds no layer of its own between a
  person and the model, the counterparty, or the currency (ADR-0009, core
  principle 7).
- **Winner per situation.** Nothing is wired to one vendor. Every provider,
  registrar, and payment rail is a row or a config entry, never a branch.
- **Cost pass-through.** Where OrangeCat resells a vendor (domains,
  inference), the user sees the vendor's price. Any margin is a number in one
  config file with its reason next to it, never hidden in copy.
- **Evidence over claims.** A capability exists when a test proves it; a
  price exists when the charge side and the display side agree.

## 3. What is most valuable — an answer

Models commoditise, compute gets cheaper per unit, and a domain costs ten
francs. None of those is the moat. What compounds is the **verifiable record
of what an identity did**: who paid whom, what was delivered, what the Cat
did on someone's behalf and whether it was right, which name a person has
answered to and since when. OrangeCat already holds the primitives — a
username that is also a payment address with a permanent rename history, a
claimable page for someone not yet here, a Cat that logs its denials as well
as its wins, and a `transparency_scores` table nothing writes yet. The most
valuable thing to build is the layer that turns those into a **portable,
checkable reputation** that a person owns and can take elsewhere. Domains
are the first outward-facing piece of that: a name you control, proven by
control, not by an account.

## 4. Workstreams

### W1 — Any model, no content layer. DONE (2026-09-14, ADR-0009)

A key can name its own endpoint; a no-auth server keeps the tool loop; every
surface derives from one provider list. Open: `ai_assistants` entities still
cannot run self-hosted; the browser-local path knows two fixed ports.

### W2 — Domain research inside OrangeCat. EXISTED + EXTENDED TODAY

It was already built: an honest RDAP pipeline (`services/domains/`), a public
keyless endpoint `GET /api/v1/domains`, and the `/domains` page. Today added:

- **The Cat can do it** — `check_domain_availability` action, low risk, no
  confirmation. It reports "no registration found" as free and "unknown"
  as unverified, never as free.
- **History** — `domain_lookups` remembers every check (web and Cat), with the
  actor when one asked. That is the dataset for a watchlist and for knowing
  which names people want.

**Research run today, straight from the registries** (Verisign for `.com`,
SWITCH for `.ch`):

| Name              | `.com`                         | `.ch`                     |
| ----------------- | ------------------------------ | ------------------------- |
| ocoin             | taken, expires 2027-12         | not checked               |
| orangecoin        | taken, locked, expires 2027-11 | not checked               |
| catcoin           | taken, locked, expires 2028-05 | not checked               |
| occoin            | taken, expires 2030-06         | not checked               |
| **orangecatcoin** | **no registration found**      | **no registration found** |

Ask the Cat for the rest; that is what it is for now.

### W3 — The domain pass (CHF 10 / year). DECIDED, NOT YET SELLABLE

**Decision recorded:** the unit is per year, and the intended price is the
registrar's own yearly fee passed through, about CHF 10 for `.ch` or `.com`.
`domains-offer.ts` now says per year (was per month); the value stays `null`
until the two-step launch below.

**What exists:** the whole pass pattern, proven twice — a product row tagged
for a plan, settled in Bitcoin, granting a time-boxed entitlement that stacks
on renewal (`services/supporter/grant.ts`, `config/loki-passes.ts`).

**The gap:** a domain pass is per _domain_, and a payment intent has no field
to carry "which domain". `user_plans` is one row per user. So:

1. Add `payment_intents.metadata jsonb` (or a `domain_orders` row created
   before checkout and referenced by the intent).
2. Add `domain_subscriptions(actor_id, domain, expires_at, last_invoice_id,
price_chf)`; grant on settlement next to `grantSupporterPlan`, idempotent
   on the invoice, stacking on renewal.
3. A product row tagged `domain-plan` + `domain-days:365`, priced at the
   pass-through fee, owned by the platform actor.
4. Launch: set `CUSTOM_DOMAIN_PRICE_CHF_PER_YEAR = 10` **and** the service
   entity's `fixed_price` in the same day — display side and charge side.
5. Renewal reminder 30 days out; on expiry the site returns to its free
   address (the page already promises this).

Provisioning (DNS, certificate) stays a Loki concern; the pass records the
right to it and pays for the name.

### W4 — Being the registrar. LATER, WITH A REALISTIC FIRST STEP

Three rungs, in order of what is actually possible:

1. **Referrer** (today): deep-links to Porkbun/Infomaniak. Earns nothing,
   promises nothing false.
2. **Reseller** (next, realistic): a registrar API behind a `custom`-style
   adapter — Porkbun, Infomaniak, OpenSRS/Tucows or Gandi all offer one.
   OrangeCat registers in the user's name, charges the vendor fee in Bitcoin,
   and the pass in W3 becomes the renewal. This is "brokering the deal".
3. **Accredited registrar** (later, maybe): ICANN accreditation carries an
   application fee, a yearly fee, data-escrow and insurance obligations;
   `.ch` needs a SWITCH registrar contract. Only worth it at a volume that
   makes the reseller margin matter. Not before.

Rule for all three: the user sees the vendor's price. Any spread is a
config number with its reason.

### W5 — Identity and reputation. NEXT, DESIGN FIRST

What exists: username with permanent rename history (also the Lightning
address), NIP-05 verification for Nostr, claimable pages for people not yet
here, `verification_status` (set by nothing), `transparency_scores` (written
by nothing), the Cat's own track record. What to build, in order:

1. **Domain as identity claim** — prove control of a custom domain the way
   NIP-05 does (a well-known file or DNS record), and show it on the profile.
   The first reputation signal that is checkable by anyone, not granted by us.
2. **Compute the transparency score** from real rows (payments settled,
   deliveries confirmed, Cat actions honoured) instead of describing it in
   copy. Publish the formula.
3. **Portable record** — an export a person can hand to another platform,
   signed, with the same recount property Solon decisions have.

### W6 — Data, swapability, compute. CONTINUOUS

- Data: `domain_lookups` is the first "remember what was asked" table; the
  Cat's action log and credit ledger are the others. Next: a per-turn cost
  row (link, model, tokens, cost) so "what does a Cat turn cost us" has a
  denominator.
- Swapability: done at the model layer (W1); repeat the pattern for
  registrars (W4) and payment rails.
- Compute: `PLATFORM_OLLAMA_URL` is the first owned inference; plans track
  the cost of compute, so owning more of it is the only durable price lever.
  The "Substrata" work the founder named is not in any repository this
  session could see — it needs to be pointed at.

### W7 — Governance in Solon. WIRE THE DECISIONS THAT EXIST

Solon already has the categories. Map the decisions above onto them so they
are recorded as decisions, not as commits:

| Decision                                | Solon category      | Electorate  |
| --------------------------------------- | ------------------- | ----------- |
| Credit markup (`CREDIT_USAGE_MARKUP`)   | `ALLOCATION_POLICY` | all members |
| Domain pass price and pass-through rule | `ALLOCATION_POLICY` | all members |
| Spending treasury on owned compute      | `TREASURY_SPEND`    | all members |
| Registrar / reseller contract           | `OPERATIONS`        | all members |
| "No content layer" as a standing rule   | `GOVERNANCE_RULES`  | humans only |

Concretely: before `CUSTOM_DOMAIN_PRICE_CHF_PER_YEAR` or the credit markup
changes, a proposal in that category, and the merged config cites the
decision id.

## 5. Order of work

1. **W3 steps 1–3** — the domain pass, so the CHF 10/year is real revenue.
2. **W5 step 1** — domain as identity claim; it shares the DNS/RDAP plumbing
   W2 already has.
3. **W4 rung 2** — one reseller adapter, chosen for API quality and Bitcoin-
   friendliness, behind the same "a row names its vendor" pattern as W1.
4. **W6** — the per-turn cost row.

## 6. Decisions only the founder can make

- **Launch the price:** set `CUSTOM_DOMAIN_PRICE_CHF_PER_YEAR = 10` and the
  service entity's `fixed_price` together. Today the code says per year but
  still `null`, so nothing is charged and nothing is misdescribed.
- **Credits:** pass-through was stated as the rule; the credit rail carries
  ×1.4 with its reasons in `credit-metering.ts`. Keep, lower, or publish it
  as the one stated margin — a Solon `ALLOCATION_POLICY` decision.
- **Reseller:** which registrar API to adopt first.
- **Substrata:** which repository or box it lives in.

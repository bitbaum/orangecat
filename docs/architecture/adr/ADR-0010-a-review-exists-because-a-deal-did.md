# ADR-0010: A Review Exists Because a Deal Did

Date: 2026-10-05
Status: Accepted. D1–D5 shipped: the schema is `20261005120000_deals_and_deal_reviews.sql`,
reviews are written at `/dashboard/deals` (`POST /api/deals/:id/reviews`), and the track record
is on every profile (`GET /api/actors/:id/track-record`). D6–D8 are still to come.

## Context

Reputation on the open web is Google-style: anyone may say anything about
anyone, rated out of five. It fails in three well-known ways:

1. **Anyone can review.** A review proves nothing about whether the writer was
   ever a customer, so reviews are bought, faked and brigaded.
2. **Stars collapse.** Ratings drift until everything sits at 4.8, and the
   number stops separating anyone from anyone.
3. **One side speaks.** The customer reviews the business. The business cannot
   say the customer never paid, and a customer who reads a bad review of
   themselves first can answer it with a worse one.

OrangeCat has what Google does not: it sees the deal. It knows that money
settled, between which two actors, for what, and how the deal ended. It is also
the identity root for the fleet (ADR-0009), so evig and Loki deals can be
attributed to the same actor. Before this ADR none of it was used. `orders` and
`payment_intents` recorded deals and nothing read them as reputation. evig had
its own `reviews` table with star ratings, and `research_reviews` was the only
review store on OrangeCat.

## Decision

**Reputation is built from observed deals first and what people said about them
second. A review can only be written about a deal the writer was part of.**

- **D1 — Deals are recorded, never declared.** `deals` holds one row per deal
  between a provider and a customer actor. No person can insert one: OrangeCat
  orders become deals by trigger when they settle (`orders.status = 'paid'`),
  and other products write through the service role. Self-dealing (same actor
  on both sides) is refused by a CHECK.
- **D2 — Fleet-wide from the first row.** `source` is `product.kind`
  (`orangecat.order`, `evig.it_hilfe`, `loki.crew_assignment`); the list is
  `src/config/reputation.ts`. Parties are OrangeCat actor ids, which evig
  already stores as `users.orangecat_actor_id`. Amounts carry a currency so a
  CHF repair and a BTC purchase sit in one table. A user can hold duplicate
  actors, so OrangeCat deals are filed against the OLDEST one
  (`primary_user_actor()`, the same rule as `lookupUserActor`), and a person's
  own deal list reads across all of them.
- **D3 — One review per side, blind until both have written.** Customer and
  provider each get exactly one review per deal. A review is visible only to
  its author until both sides have written or `review_closes_at` passes (30
  days, defined once in `deal_review_window()`). After that, nobody can write.
  Nobody can read the other side's review and then answer it.
- **D4 — No stars.** A review is a set of yes/no answers to questions in
  `src/config/reputation.ts`, plus optional text. Every side answers "Would you
  deal with them again?". That is the headline number, shown as "96% of 41"
  rather than as an average.
- **D5 — Append-only, like `research_reviews`.** No edits. The body's SHA-256
  is stored alongside it. Deals are private to their two parties. The public
  sees `actor_track_record()` counts, including distinct customers (40 deals
  with 40 people is a different fact from 40 with one), and revealed reviews.
- **D6 — Fleet writers.** A service-to-service route lets evig and Loki record
  deals and submit reviews on a person's behalf. The same database trigger
  applies to them: they cannot review for someone who was not a party.
- **D7 — Portable reviews.** Each revealed review is also published as a signed
  statement (Nostr), so a pseudonym can carry its reputation off OrangeCat and
  anyone can check it without trusting us.
- **D8 — The Cat reads it.** Before a purchase or a loan, the Cat quotes the
  counterparty's track record.
- **D9 — People are asked.** Most people never review unless asked, and a
  track record nobody writes is empty. The `review-nudges` cron (hourly,
  deterministic, no model) asks each side that has not reviewed: once 3 days
  after settlement, once in the last 5 days of the window
  (`REVIEW_NUDGES`). `deal_review_nudges` records each nudge before it is
  sent, so none is sent twice. When one side reviews, the other is told
  THAT it happened, never WHAT was said. The Cat's dashboard suggestions
  carry the most urgent unreviewed deal.

Tips are not deals and never become one: a gift tests nothing about whether
anyone delivered.

## Consequences

- A fake review now costs a real, settled payment to yourself through a second
  account. It shows up as a low `distinct_customers` count.
- Support contributions and loans are not deals yet. Each needs its own answer
  to "what did the provider owe?" before it joins. Loans have the clearest one:
  repayment on schedule.
- Orders never reach `completed` today. Settlement stops at `paid`, so the
  trigger starts a deal at settlement and follows later states once the product
  sets them. Until then, `deals_provided_completed` stays at zero, and the
  review is the customer's only way to say the deal went well.
- evig's star-rated `reviews` stay where they are until D6 ships. Its
  `is_verified_purchase` rows are the ones that can migrate as deals.
- Group-owned deals are visible only to an individual party, not to the group's
  members. That needs a group-membership policy when group commerce lands.

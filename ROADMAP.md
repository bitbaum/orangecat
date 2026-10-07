# Roadmap

First make public entities effortless to share, fund in Bitcoin, and turn into
supervised Loki projects. Broaden the rails only after that loop is dependable.
Nothing here is dated: the order carries the argument, and nothing is presented
as shipped before it is. This file is the record the fleet map
(`loki.orangecat.ch/api/fleet/map`) reads;
[orangecat.ch/roadmap](https://orangecat.ch/roadmap) renders it from there.

## Now

### Share and fund anything

Make every eligible public entity easy to share and support in Bitcoin, including for people without an OrangeCat account.
No fiat, privacy-coin, or smart-contract controls are presented as if they work today.

- [ ] One clear “Support with Bitcoin” action alongside buying, booking, or joining.
- [ ] Tracked public payment requests with confirmed amounts attributed to the correct entity.
- [ ] Consistent share controls and link previews across public entity pages.
- [x] Open accounting: a wallet can publish its balance, its transactions, and the owner’s note on each one — for owners who turn it on.
- [x] A transparency score computed from what is observable in that ledger, never from what anyone claims about themselves.

### Events, end to end {#events}

Run a real night on OrangeCat — "electronic music night at Espresso Bar in Landquart on Friday" — from the first sentence to the last guest through the door, and pay the people who made it happen. The plan and how it was tested: `docs/features/events-end-to-end.md`.

- [x] One sentence to the Cat makes the whole event: on the map, music and vibe, crew wanted, priced in your currency. {#event-one-sentence}
- [x] Find what's on near you, on the page and through the Cat. {#events-nearby}
- [x] Times in the venue's own time zone, everywhere. {#event-time-zones}
- [x] Tickets with a QR code, checked in at the door. {#event-tickets}
- [x] A page for the place, listing what's on there, run by whoever runs the place. {#venue-pages}
- [x] The crew are people; the door crew check guests in. {#event-crew}
- [x] Pay the crew and refund tickets from the organizer's wallet, on the event's record. {#event-payouts}
- [x] Cover pictures: upload, find, generate, or the photo sent to the Cat. {#event-cover}
- [ ] Guests without an account can get a ticket or RSVP. {#event-rsvp-guests}
- [ ] Tickets paid with Twint, bank or PayPal (waits on "More rails"). {#event-fiat-tickets}

## Next

### Fund-to-build

Connect OrangeCat entities to Loki projects without forcing people to understand two internal systems.

- [x] Send any actionable OrangeCat entity to Loki with a signed, owner-approved handoff.
- [ ] Link a Loki project back to its public OrangeCat funding and promotion page.
- [ ] Let Loki propose a practical plan while the owner chooses what agents may execute.
- [ ] Show a read-only Bitcoin funding summary inside the linked Loki project.

### Metered Cat Credits as the paid token pool for builders

Loki's builders bring their own model key first; the paid pool behind "meter it" is OrangeCat's Cat Credits economics — tokens bought wholesale on our accounts and sold inside a plan, the way Cat Credits already price frontier models at provider cost plus forty percent. Cat Credits are priced today; the checkout stays deliberately shut until OrangeCat is a registered company.

- [x] Cat Credits priced on every route, from one source.
- [x] One server-side switch decides whether OrangeCat may charge at all, off by default.
- [ ] Token use from a Loki run recorded against the builder's credit balance.
- [ ] The checkout opens, once OrangeCat may legally take money.

## Later

### Partner payouts and client funding through OrangeCat rails

A partner paid for a café site, and a café owner funding the work, both settle through OrangeCat's Bitcoin rails. Who becomes a partner and what a partner is owed are Solon votes; the money moves here.

- [ ] A Loki partner receives a payout to their OrangeCat wallet when a client site ships.
- [ ] A client funds a Loki build from the project's public OrangeCat page.

### More rails and deeper coordination

Broaden only after the Bitcoin fund-to-build loop works reliably for ordinary users.

- [ ] Fiat rails such as Twint require bank, identity, reconciliation, and custody decisions. They are not available now.
- [ ] Privacy coins improve confidentiality but cannot provide the same public funding audit trail. They are not available now.
- [ ] Smart contracts may support escrow and milestone releases after disputes and oracle boundaries are designed.
- [ ] Full Nostr identity, relay federation, and automatic funding-driven dispatch remain research, not current product claims.

## Shipped

### Public pages for every entity

Public pages for people, projects, groups, products, services, events, and other entities.

### Non-custodial Bitcoin payments

Non-custodial Bitcoin payments through Lightning, Lightning Address, NWC, and on-chain addresses.

### Public funding records

Public project funding records based on confirmed Bitcoin settlement.

### Human-approved Cat actions and the Loki identity bridge

Human-approved Cat actions and an identity bridge to Loki.

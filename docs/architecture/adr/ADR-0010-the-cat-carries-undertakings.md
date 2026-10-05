# ADR-0010: The Cat Carries Undertakings

Date: 2026-10-05
Status: Proposed (D1 shipped as `src/config/cat-playbooks.ts`; D2–D7 not started)

## Context

The ask: "Throw a party" should be one sentence, and everything after it taken
care of. Then the generalisation: a conference is the same pattern, and so are
a group gift, a club, a trip, a fundraiser. People should be able to do all of
it, without a wall of options, with the Cat as the way in and the rest of the
app as the place to check how it is going.

The Cat can already do most of the pieces. What it cannot do is hold them
together. Measured on the branch that ships D1:

|                                        |                                                                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Cat actions                            | 58, each handler-backed (`CAT_ACTIONS`)                                                                                    |
| Actions per reply                      | **6** (`MAX_ACTION_STEPS`), a model round trip each                                                                        |
| Confirmation unit                      | **one action**: one `cat_pending_actions` row each, 24 h expiry, no field that groups them                                 |
| What links the things one request made | **nothing**. An event, its wishlist, the invitations and the reminder are four unrelated rows                              |
| Follow-ups                             | `cat_watches` has three kinds: `funding_reached`, `sale_received`, `booking_received`                                      |
| RSVP on a personal event               | **none**. `event_attendees` exists and nothing writes to it; `current_attendees` is always 0. Only group events take RSVPs |
| Inviting someone not on OrangeCat      | groups only (`group_invitations` takes an email or a token); `send_message` reaches users only                             |
| Splitting costs, settling up           | **none**                                                                                                                   |
| Playbooks                              | one (`HOLD_AN_EVENT`), plus "Setting Someone Up End to End" written as prose in the system prompt                          |

So after "throw a party" the Cat creates four things and the conversation ends.
Nobody can reply to the invitation unless they already have an account, the host
cannot see who is coming, and nothing comes back a week later to say the drinks
are 60% covered. The pieces work; the undertaking does not exist.

## Decision

### D1 — Playbooks are knowledge the Cat carries, never a menu (shipped)

An undertaking starts in the person's own words, at the one door that already
exists (the Cat). There is no occasion catalogue in the UI: a list of "throw a
party / plan a trip / start a club" is one more thing to read, and the point is
that nobody has to.

`src/config/cat-playbooks.ts` is the only list. A playbook is a trigger, the
sentences a person would say, the questions asked once, how the plan sizes
itself, and steps that each name a Cat action, `conditional` where they apply.
Each renders as one SITUATIONAL prompt section, so it costs nothing on an
unrelated turn. `cat-playbooks.test.ts` fails if a step names an action without
a handler or if a playbook's own examples stop loading it.

**Few and broad.** One "hold an event" that sizes itself from a dinner for eight
to a ticketed conference, not a playbook per occasion. The target is about six,
one per intent in `src/config/intents.ts`:

| Playbook                         | Built from                                                                     | Blocked on      |
| -------------------------------- | ------------------------------------------------------------------------------ | --------------- |
| Hold an event                    | event, wishlist, booking, messages, promotion, reminder, group vote, Loki site | — (shipped)     |
| Raise money for something        | project / cause, wishlist, promotion, `explore_topic`, watch                   | —               |
| Sell or offer something          | products / service, promotion, site                                            | —               |
| Help someone                     | cause, private group, messages (no promotion, ever)                            | —               |
| Lend or invest                   | loan / investment, reminders on both sides, Solon for investors                | —               |
| Do something together with money | group, shared wallet, proposals                                                | D5c (splitting) |

"Setting Someone Up End to End" moves into this list as a seventh entry rather
than staying the only playbook written as prose.

### D2 — An undertaking is a record

Two tables, actor-owned like everything else:

```
undertakings        id, actor_id, created_by, playbook_id, title, goal,
                    due_at, status (planning|active|done|abandoned),
                    conversation_id, created_at, closed_at
undertaking_items   undertaking_id, step (the playbook step it fulfils),
                    ref_type, ref_id   -- entity type + id, proposal, task,
                                       -- watch, pending action, booking
```

Items hold **references only**. Whether the event is published, the wishlist
funded or the proposal passed is read from the row that owns that fact, never
copied here — a copy is a second source of truth that goes stale.

The Cat creates the undertaking when it proposes a plan, and every action it
takes under that plan records an item. "Your party" next week resolves to this
row, so the Cat can pick up where it left off instead of starting again.

Owned by `actor_id`, so a group can have undertakings (the club's summer
party), and RLS follows the actor like every other entity.

### D3 — One plan, one approval

The plan comes back as one card: each step on a line, each line editable or
removable, one button to approve. Approving confirms every pending action in it,
in order, through the same `CatActionExecutor` path as today: one permission
check, one spend-cap check and one `cat_action_log` row **per action**. Batching
changes how many taps it takes, not what is checked or recorded.

`cat_pending_actions` gains `undertaking_id`. Approved actions run server-side
after the tap, not inside the model loop, so `MAX_ACTION_STEPS` stays a ceiling
on the model's own round trips and stops being a ceiling on plan size. A step
that fails shows its own error on its own line; the rest still run.

Anything that spends money keeps its own confirmation and restates the amount
and recipient, inside the card as today.

### D4 — The place to check how it is going

The dashboard's list of things becomes a list of undertakings, each one line:
what it is, when, and the one fact that matters now ("8 of 12 replied",
"drinks 60% covered", "vote closes Friday"). Opening one shows its items with
live state, what is waiting on the person, and what the Cat will do next.

The entity pages stay exactly as they are. Guests and backers need them, and
they are what the undertaking links to. They stop being the owner's way in.

### D5 — The capabilities "taken care of" needs, in order of value

a. **RSVP on any event, including from someone without an account.** Let
`event_attendees` take a display name and a token instead of a user id. A
name is enough: pseudonymous by default. This is what gives the host a
number to look at and the Cat something to follow up on.

b. **Invite people who are not on OrangeCat**, by email or by a share link
whose replies are tracked. `group_invitations` already does this for groups
with its email / token target; events reuse the pattern rather than a
second one. This is also how the product grows: every guest arrives at a
page that works without an account.

c. **Split costs and settle up.** A shared expense ledger per group or
undertaking: who paid, for whom, net balances, and one action that settles a
balance by any payment method the payee accepts (Lightning first, as
`send_payment` does today). Amounts are recorded in the payer's currency and
converted for display; BTC is stored as BTC.

d. **Recurring contributions**: club dues, a rent share.

e. **Booking several services at once**: venue and catering in one plan
(falls out of D3 once `book_service` can take part in a plan).

### D6 — Follow-ups ride on watches

`cat_watches` gains kinds tied to an undertaking: `rsvp_count`,
`deadline_near`, `proposal_decided`, `wishlist_funded`. When one fires, the
proactive-nudge path already on main (`src/services/cat/nudges.ts`) turns it
into one message, with an action attached when there is one to take ("nudge
the four who haven't replied?"). The nudge policy decides when not to speak,
the same as today.

### D7 — Each playbook is tested by running it

A playbook lands with an eval: a scripted conversation, the plan it should
produce, and every action in that plan executing against the mocked DB that
`action-executor-columns.test.ts` already uses. Writing D1 found that every
Cat-created event had failed since the action existed; no unit test of the
config would have caught that, and a run would have.

## Consequences

- **People see fewer choices and get more done.** The surface does not grow
  with the number of things the platform can do; the Cat's knowledge does.
- **The economics hold.** Person-to-person payments stay free. Undertakings are
  long-running and need a lot of the Cat's help, which is exactly what Cat
  Credits and the Supporter plan charge for. Groups and Vereine with dues, a
  shared purse and Solon-signed decisions are the closest thing to an
  organisation customer the platform has.
- **The metric changes.** Count undertakings that reach `done` with their core
  items in a good state (the event happened, the gift was funded, the balances
  were settled), and guests who became members, not entities created.
- **Two new tables and one column** (D2, D3), plus D5a's change to
  `event_attendees`. Every other piece reuses an existing mechanism.

## Non-goals

- No occasion catalogue, wizard or template gallery in the UI.
- No action without the person's approval. Batching is one tap for many
  actions, never zero taps.
- Solon stays prefill-only from OrangeCat: a member files and signs there.
- Loki is offered only when someone asks for something built.

## Phasing

1. **Undertakings you can see**: D2, D3, D4. One migration. Makes the shipped
   event playbook visible and resumable.
2. **Undertakings that come back to you**: D5a, D5b, D6. The guest side and the
   follow-ups.
3. **The other playbooks**, one at a time with D7: raise money, sell or offer,
   help someone, lend or invest, then "together with money" after D5c.

## Open questions

1. **The user-facing word.** "Undertaking" is the engineering name. "Plans" is
   taken by pricing (`cat-plans.ts`). Candidates: "What you're working on",
   "Your things in motion", or just the undertaking's own title with no
   category word at all.
2. **Guest RSVPs without an account (D5a):** a name only, or a name plus an
   optional email so the host can reach them? The privacy principle argues for
   name only, with email strictly opt-in.
3. **Who owns a group's undertaking:** any member, or only admins? Proposals
   already answer this for spending; does creating an undertaking need an
   answer at all?

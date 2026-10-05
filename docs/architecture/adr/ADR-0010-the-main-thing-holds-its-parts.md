# ADR-0010: The Main Thing Holds Its Parts

Date: 2026-10-05
Status: Proposed (D1 shipped as `src/config/cat-playbooks.ts`; D2–D7 not started)

## Context

The ask: "throw a party" should be one sentence to the Cat, and everything after
it taken care of. A conference is the same pattern, and so are a group gift, a
club, a trip, a fundraiser. People should be able to do all of it without a wall
of options: the Cat is the way in, and the rest of the app is where they check
how it is going.

The Cat can already make most of the pieces. What it cannot do is keep them
together. Measured on the branch that ships D1:

|                                    |                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Cat actions                        | 58, each handler-backed (`CAT_ACTIONS`)                                                                                    |
| Actions per reply                  | **6** (`MAX_ACTION_STEPS`), a model round trip each                                                                        |
| Confirmation unit                  | **one action**: one `cat_pending_actions` row each, 24 h expiry, nothing that groups them                                  |
| What links the things one ask made | **nothing**. An event, its wishlist and its reminder are unrelated rows; `stakeholder_relationships` links projects only   |
| Follow-ups                         | `cat_watches` has three kinds: `funding_reached`, `sale_received`, `booking_received`                                      |
| RSVP on a personal event           | **none**. `event_attendees` exists and nothing writes to it; `current_attendees` is always 0. Only group events take RSVPs |
| Inviting someone not on OrangeCat  | groups only (`group_invitations` takes an email or a token); `send_message` reaches users only                             |
| Splitting costs, settling up       | **none**                                                                                                                   |
| Translation                        | **none yet**; user-facing copy is English, much of it already gathered in config (`plain` copy in the registry)            |

So after "throw a party" the Cat creates four things and the conversation ends.
Nobody can answer the invitation without an account, the host cannot see who is
coming, and nothing comes back a week later to say the drinks are 60% covered.

### The option this replaces

An earlier draft of this ADR added a new concept, the "undertaking": a record
above the entities that remembered which things belonged together. It was
rejected for three reasons:

1. **It is a second answer to "what is this?"** The party already has a name and
   a page: it is an event. A layer above it means a person must understand two
   things where they understood one, and the founder's first reaction to the
   draft was confusion, which is the reaction a user would have too.
2. **It needs a category word on screen**, and every candidate ("undertaking",
   "plan", "project") was either taken, vague, or one more thing to translate.
3. **Every goal already has a main thing.** See D2. A container would only ever
   duplicate it.

## Decision

### D1 — Playbooks are knowledge the Cat carries, never a menu (shipped)

A goal starts in the person's own words, at the one door that exists (the Cat).
There is no catalogue of occasions in the UI: a list of "throw a party / plan a
trip / start a club" is one more thing to read, and the point is that nobody
has to.

`src/config/cat-playbooks.ts` is the only list. A playbook is a trigger, the
sentences a person would say, the questions asked once, how the plan sizes
itself, and steps that each name a Cat action, `conditional` where they apply.
Each renders as one SITUATIONAL prompt section, so it costs nothing on an
unrelated turn. `cat-playbooks.test.ts` fails if a step names an action without
a handler, or if a playbook's own example sentences stop loading it.

**Few and broad.** One "hold an event" that sizes itself from a dinner for eight
to a ticketed conference, not one playbook per occasion. About six in total, one
per intent in `src/config/intents.ts`:

| Playbook                         | Its main thing        | Blocked on      |
| -------------------------------- | --------------------- | --------------- |
| Hold an event                    | the event             | — (shipped)     |
| Raise money for something        | the project or cause  | —               |
| Sell or offer something          | none (just listings)  | —               |
| Help someone                     | the cause             | —               |
| Lend or invest                   | the loan / investment | —               |
| Do something together with money | the group             | D5c (splitting) |

"Setting Someone Up End to End", today written as prose in the system prompt,
moves into this list as one more entry.

### D2 — The main thing holds its parts

Every goal has a main thing, and it is an entity that already exists: the party
is the **event**, the trip or the club is the **group**, the fundraiser is the
**project** or **cause**, the group gift is the **wishlist**. Everything the Cat
makes for that goal is a **part** of it: the wishlist and the reminder belong to
the event; the vote on the shared purse belongs to the group's event.

One small table records that, and nothing else:

```
entity_parts   owner_actor_id, parent_type, parent_id,   -- the main thing
               part_type, part_id,                        -- an entity, a group
                                                          -- proposal, a task,
                                                          -- a watch, a booking
               created_by, created_at
               UNIQUE (part_type, part_id)   -- a part has one main thing
```

`parent_type` is always an entity type from the registry; `part_type` is one of
the registry's types or one of the few non-entity kinds named in config, checked
at the write boundary like every other app-level enum. Rows hold **references
only**: whether the event is published, the wishlist funded or the proposal
passed is read from the row that owns that fact, never copied here.

A playbook names which step creates its main thing (`create_event` for "hold an
event"), or which existing thing it is (a group the person is in). When the
person comes back next week with "how's my party?", the Cat finds the event and
reads its parts. There is nothing new for the person to learn: their party is
their event, as it always was.

### D3 — One plan, one approval

The plan comes back as one card: each step on a line, each line editable or
removable, one button to approve. Approving runs every action in it, in order,
through the same `CatActionExecutor` path as today: one permission check, one
spend-cap check and one `cat_action_log` row **per action**. Batching changes
how many taps it takes, not what is checked or recorded.

- `cat_pending_actions` gains `batch_id`, set on every action proposed in one
  reply.
- Approved actions run server-side after the tap, not inside the model loop, so
  `MAX_ACTION_STEPS` stays a ceiling on the model's own round trips and stops
  being a ceiling on how big a plan can be.
- Later steps refer to the main thing the first step creates (the wishlist
  needs the event's id). The executor fills that in once the first action
  returns, and records each part in `entity_parts` as it goes.
- A step that fails shows its own error on its own line; the others still run.
- Anything that spends money keeps its own confirmation and restates the amount
  and recipient, inside the card as today.

### D4 — Where to check how it is going

Nothing new to navigate. The main thing's own page shows its parts and their
live state: who is coming, how much of the wishlist is funded, which vote is
open, what is waiting on the owner, what the Cat will do next. The dashboard's
existing rows for the person's things gain one line each, the one fact that
matters now ("8 of 12 replied", "drinks 60% covered", "vote closes Friday"),
derived from the parts.

Guests and backers see the same public page as today; the parts that are public
(the wishlist, the RSVP) appear on it, the private ones (the reminder, the
owner's tasks) only for the owner.

### D5 — What "taken care of" still needs, in order of value

a. **RSVP on any event, including from someone without an account.** Let
`event_attendees` take a display name and a token instead of a user id.
This is what gives the host a number to look at and the Cat something to
follow up on.

b. **Invite people who are not on OrangeCat**, by email or by a share link
whose replies are tracked. `group_invitations` already does this for groups
with its email / token target; events reuse that shape rather than inventing
a second one. This is also how the product grows: every guest arrives at a
page that works without an account, and leaves knowing they could make one.

c. **Split costs and settle up.** A shared expense ledger on the main thing
(the trip's group, the party's event): who paid, for whom, net balances, and
one action that settles a balance by any payment method the payee accepts
(Lightning first, as `send_payment` does today). Amounts are recorded in the
payer's currency and converted for display; BTC is stored as BTC.

d. **Recurring contributions**: club dues, a rent share.

e. **Booking several services in one plan**: venue and catering (falls out of
D3 once `book_service` can take part in a batch).

### D6 — Follow-ups ride on watches

`cat_watches` gains kinds that point at a main thing: `rsvp_count`,
`deadline_near`, `proposal_decided`, `wishlist_funded`. When one fires, the
proactive-nudge path already on main (`src/services/cat/nudges.ts`) turns it into
one message with an action attached when there is one to take ("nudge the four
who haven't replied?"). The nudge policy decides when not to speak, as today.

### D7 — Words people see, in any language

- **Code words never reach the screen.** "Entity", "playbook", "part", "main
  thing" are for this repo. A person sees the names they wrote themselves ("Anna's
  30th"), which never need translating, and the plain verbs already gathered in
  config ("Hold an event", "Raise money").
- **No new category words.** Each one is a concept to learn and a string to
  translate; this ADR adds none.
- **No sentence assembled from pieces.** `"You have " + n + " guests"` has to be
  rewritten for every language; `"You have {n} guests"` can be translated as it
  is. New copy for D4–D6 is written the second way from the start, so the day
  translation arrives it is a mechanical sweep, not a rewrite. (Solon already
  holds itself to this rule.)
- **The Cat speaks the person's language already.** Playbook triggers match more
  than English, and `cat-playbooks.test.ts` keeps a non-English example per
  playbook so that stays true.

### D8 — Each playbook is tested by running it

A playbook lands with an eval: a scripted conversation, the plan it should
produce, and every action in that plan executing against the mocked DB that
`action-executor-columns.test.ts` already uses. Writing D1 found that every
Cat-created event had failed since the action existed; no test of the config
alone would have caught that, and a run would have.

## Consequences

- **Fewer concepts, more done.** The surface does not grow with the number of
  things the platform can do; the Cat's knowledge does. The only new table is a
  list of links.
- **The economics hold.** Person-to-person payments stay free. A goal with parts
  and follow-ups needs a lot of the Cat's help, which is what Cat Credits and the
  Supporter plan charge for. Groups and Vereine with dues, a shared purse and
  Solon-signed decisions are the closest thing to an organisation customer the
  platform has.
- **The metric changes.** Count main things whose goal happened (the event took
  place, the gift was funded, the balances were settled), and guests who became
  members, not entities created.
- **Schema:** `entity_parts`, `cat_pending_actions.batch_id`, and D5a's change to
  `event_attendees`. Every other piece reuses an existing mechanism.

## Non-goals

- No occasion catalogue, wizard or template gallery in the UI.
- No container above the entities, and no word for one.
- No action without the person's approval. One tap for many actions, never zero.
- Solon stays prefill-only from OrangeCat: a member files and signs there.
- Loki is offered only when someone asks for something built.

## Phasing

1. **The main thing shows its parts**: D2, D3, D4. One migration. Makes the
   shipped event playbook visible and resumable.
2. **It comes back to you**: D5a, D5b, D6. The guest side and the follow-ups.
3. **The other playbooks**, one at a time with D8: raise money, sell or offer,
   help someone, lend or invest, then "together with money" after D5c.

## Open questions

1. **Guests without an account (D5a):** a name only, or a name plus an optional
   email so the host can reach them? The privacy principle argues for name only,
   with email strictly opt-in.
2. **Planning on behalf of a group:** when the main thing belongs to a group (the
   club's summer party), can any member have the Cat plan it, or only admins?
   Spending is already answered (it goes to a vote); this is about who may create
   the event and its parts in the group's name.

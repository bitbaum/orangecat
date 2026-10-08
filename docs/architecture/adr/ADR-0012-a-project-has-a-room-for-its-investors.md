# ADR-0012: A Project Has a Room for Its Investors

Date: 2026-10-08
Status: Accepted (D1–D5 shipped; D6–D8 on the roadmap under `#investor-rooms`)

## Context

The studio builds several products (Heidi, Loki, Substrata, …) and wants to show
each of them to investors the way a YC company would: a pitch, a deck, live
numbers, diligence documents — sent to specific people, with the founder able
to see who actually opened what. That last part is the reason a founder uses a
data room instead of a PDF attachment.

Heidi had built its own: a password-gated `/investors` page with the pitch and
numbers typed into a config file. Doing that again in every product means N
copies drifting apart (Heidi's typed "65 PRs" was already stale), N passwords,
and no product able to say who opened anything.

Where should the one room live? It was first proposed for Loki (it already
sends the founder Telegram alerts). It belongs in OrangeCat instead:

- Investing is in OrangeCat's mission ("exchanging, funding, lending,
  investing, and governing"), and it already has public project pages, an
  `investments` entity, `/raise`, and the account every studio app signs in with
  (ADR-0009).
- Measured 2026-10-06: **Heidi, Loki and Substrata are already OrangeCat
  projects**, each with a public page and (Heidi, Loki) a linked Loki build
  record. Nothing new has to exist for a product to have a room — only the
  room.

What was missing, measured on `e830cb7b4`: per-person access grants (none),
documents attached to an entity (`user_documents` has no entity), per-viewer
view tracking (only `profile_claims.view_count`), and a project↔investment link
(`investments` has no `project_id`).

## Decision

### D1 — The room is a part of the project, not a new kind of thing

Not an entity: the registry admits a type only if it holds a wallet
(`entity-registry.ts`), and a room holds none. Not a page of a new kind: per
ADR-0011, the main thing holds its parts, and the main thing here is the
project. So: `project_rooms` (one per project), reached from an owner-only
"Investor room" card on the project page, managed at `/projects/<id>/room`. No
navigation item — the sidebar is already dense, and the only people who need
the room are the owner and the people the owner sends it to.

### D2 — What the owner sends is a personal link

`project_room_links`: one row per person, carrying a `token` that is the
credential (`/room/<token>`). The row `id` is internal, so links can be listed
and revoked without exposing them — the lesson of `profile_claims`
(20260907110000). No account and no password: an investor told about a product
should be one tap from reading about it. The personal link is what makes "who
opened what" true; a shared password can never say who it was.

The page says who it is for ("Private, for Anna Keller") and asks the reader
not to forward it, because a link that names its reader is one that reader does
not forward.

### D3 — A product's own site is the door, OrangeCat is the room

A person who hears "heidi.orangecat.ch/investors" types that, not an OrangeCat
URL. So the product keeps its `/investors` page as the public door — the pitch
in a line, "request access", the easy password for people the founder told in
person — and the door hands into the same OrangeCat room through a link marked
`is_shared` ("Heidi website"). Opens through it are counted together, honestly
labelled as a door rather than a person. One room, stored once; never a copy
per product. (The door is D6, below.)

### D4 — Counting opens honestly

- `project_room_opens` records `room` (the page), `deck`, `document` and
  `build`. Everything inside the room is followed through
  `/room/<token>/open/<what>`, which looks the destination up in the room's own
  content — never from the request, so it is not an open redirect.
- A refresh within 30 minutes is the same visit.
- **Link-preview fetchers are not people.** Pasting a link into WhatsApp,
  Telegram, Slack or iMessage makes the app fetch it for the preview card, which
  would report "Anna opened it" the moment the owner pressed send.
  `src/lib/link-preview-bots.ts` recognises them; in-app browsers (LINE,
  Facebook) are people and are counted. The same fix is applied to profile
  claim links, which had the same flaw.
- The owner previewing their own room is not counted.
- The owner is notified (in-app, and by email they can turn off) the first time
  each link is opened.

### D5 — Information only; money moves elsewhere

The room shows; it does not take investment. An "invest" action is a securities
question and stays behind the legal work and Solon, per the OC↔Solon direction
(grants before lending before investment). When a project has an `investments`
offering, the room will link to it (D8) rather than become one.

Content is plain text in sections, not markdown — the room is read by people
the owner hand-picked, and must never run anything they did not write. Links
live in `documents`, where each open is seen. All three tables are
service-role-only (no anon/authenticated policies): a token-addressed read is
not expressible in RLS without leaking every room.

### D6 — Next: the product site as the door (#room-door)

Heidi's `/investors` unlock hands into its shared OrangeCat link; its typed
`investors.ts` content moves into the room.

### D7 — Next: live numbers from Loki (#room-live-numbers)

Loki already reads each project's roadmap, changelog and repository. The room
shows those numbers, each with how to check it, instead of numbers anyone
types. Until then the room links to the project's Loki build record.

### D8 — Next: files, the offering, and the Cat

Documents uploaded to the private `documents` bucket and opened through
expiring signed URLs (#room-files); the project's investment offering linked
from its room once `investments` can name its project (#room-offering); and
"send Anna a link to the Heidi room" as a Cat action (#room-cat).

## Consequences

- Every OrangeCat project can have a room today, including group-owned ones
  (ownership is `checkOwnership` on the project's actor).
- A product needs no investor code of its own beyond a door.
- The studio's products are owned by a person's account, not a company group.
  Moving them to a "bitbaum" group is a separate decision; nothing here depends
  on it.

# The investor portal

Status: phase 1 in progress (2026-10-08). Decision record for the room itself:
`docs/architecture/adr/ADR-0012-a-project-has-a-room-for-its-investors.md`.

## What it is for

A founder sends one link. The person who opens it should be able to **judge the
project from that page alone** — decide whether it is worth their time and
money — without a call, a deck request or taking anyone's word for anything.

It is the investor-facing surface of the studio's machine: products built with
Loki, funded through OrangeCat, governed on Solon. That machine's argument is
that it builds faster and more honestly than a company could; the portal is
where that argument is either shown or not.

## Who reads it

An investor (angel, fund, a studio partner), usually on a phone, usually from a
link in a chat, with a few minutes. They are deciding _whether to spend more
time_, not whether to wire money. Their first screen has to answer: what is
this, is it real, is it moving, and what is being asked.

## What lets them judge — ranked by how hard it is to fake

|     | Evidence                                                       | Source                                                     | Phase      |
| --- | -------------------------------------------------------------- | ---------------------------------------------------------- | ---------- |
| 1   | **Execution**: how fast it ships, week by week                 | the repository's default branch (GitHub, public)           | 1          |
| 2   | **What actually shipped**, dated                               | the product's public changelog, via Loki's fleet map       | 1          |
| 3   | **Promises vs delivery**: roadmap done / in progress / planned | the product's ROADMAP, via Loki                            | 1          |
| 4   | **Why it exists**: problem, solution, mission, vision          | the product's identity record, via Loki                    | 1          |
| 5   | **Traction**: people using it, coming back, paying             | the product itself — a public metrics endpoint (see below) | 2          |
| 6   | The founder's story, market, team, **risks**, the ask          | written by the owner in the room                           | 1 (exists) |
| 7   | Terms: the investment offering, when there is one              | OrangeCat `investments`, linked to the project             | 2          |
| 8   | The portfolio: the studio and every product in it              | the fleet map                                              | 3          |

Rules every row obeys:

- **Generated beats written.** Anything a system can count is counted, never
  typed. A typed number goes stale and the reader cannot tell (Heidi's "65 PRs").
- **Every figure says where it comes from**, and links there when it can.
- **Nothing is inflated, and absence is stated plainly** — "no revenue yet" reads
  better to an investor than a page that never mentions revenue.
- **A source that is down costs the page nothing**: the section is left out, the
  rest renders. Never a spinner, never an error box.
- **The reader is told the room is not anonymous**: the owner sees when a link
  is opened and what is opened in it.

## Phases

**Phase 1 — the room shows the evidence it can generate.** For a project linked
in Loki: key facts at the top (live since, shipped in the last 30 days, changes
to main in the last 12 weeks, roadmap progress), a weekly shipping chart, the
recently shipped list, the roadmap by status, and the product's identity — all
with sources. A "Risks" section joins the owner's outline. A section index so a
reader can jump. The disclosure line.

**Phase 2 — traction and conversation.**

- A _public metrics contract_ each product implements:
  `GET <product>/api/public/metrics` →
  `{ asOf, metrics: [{ key, label, value, unit?, verify }] }` — counts the
  product's own database can prove (accounts, active in 7/30 days, retained,
  revenue if any). Heidi first. Lives in a fleet package once a second product
  adopts it (fleet `SHARED.md` rule).
- Questions in the room: a reader asks, the owner is notified, the answer is
  visible to everyone holding a link to that room (the data-room Q&A).
- Investor updates: a dated feed in the room, from the project's own updates.
- The project's investment offering in the room (needs `investments.project_id`).

**Phase 3 — the studio room.** One link for the whole portfolio: the thesis,
every product with its evidence row, and the machine's own numbers (products
live, changes shipped across the fleet). At that point the portal is a product
of its own and may move out of OrangeCat into its own app reading the same
sources; the code is kept in `src/domain/projectRooms` and
`src/components/room` so that move is a lift, not a rewrite.

## The deck (shipped 2026-10-08)

A room can hold a deck made in the room, built on `@bitbaum/deckkit`
(`packages/deckkit`; its README has the writing rules). Decisions, from first
principles and from what evig's hand-written decks taught:

- **A deck is data, not HTML.** Slides are a layout plus a few fields; one
  renderer draws them. Anyone can edit one; nobody can make one ugly; any app
  can show one. (Evig's decks could only be changed by a developer and each
  carried its own drifting copy of the engine.)
- **Generated first, then owned.** "Generate a first draft" builds the investor
  arc from the room and the product record — every word comes from there. The
  owner edits from that.
- **Live where it can be.** Proof slides (`bind: facts | pace | roadmap`) read
  the room's evidence whenever the deck is opened.
- **One frame.** 16:9 at every size via container units, so the editor's
  thumbnails, the preview and full screen are the same slide.
- **Linkable, printable, measured.** `#3` opens slide 3; "PDF" prints every
  slide as a page with real text; opening the deck is an open in the room.
- Next: comments per slide (anchored to the slide's stable id, which evig's
  index-anchored comments lacked), screenshots uploaded instead of linked,
  per-slide reading time, and an optional "tighten this slide" with AI, on
  request only.

## Not in scope

An "invest" button (securities; waits on legal work and Solon — ADR-0012 D5).
Anything that requires the reader to make an account.

# ADR-0013: Companions Talk Together

Date: 2026-10-30
Status: Accepted (D1–D5 shipped; D6–D8 on the roadmap)

## Context

Grok Bot (SpaceX Super Intelligence, August 2026) made a product out of a
shape the fleet already had in pieces: a messaging app whose contacts are
bots. One list, newest first; a face, a name with its job, the last line and
when; a "+" that offers a new bot or a new group chat; a bot made from a name,
a shape and a colour, which asks what it is for in its first message; group
chats of two to six bots that answer in turn and hand work to each other with
an `@`; a status line that says who is writing; connectors a bot may use; a
voice call. The owner's brief: have that as part of our offering, for what we
do, better and simpler, model-agnostic, and from first principles rather than
a blind copy.

OrangeCat already had the bot: an `ai_assistant` ("companion") has a
creator's definition, a memory of each person it talks to, a clone that
leaves the memories behind, a public profile on Discover, a price per message
settled in Cat Credits, and its own purse. It answers on the person's own key
or on the shared free chain, so it is model-agnostic by construction. What it
lacked was the home (every companion was its own page), group chats, and the
fleet's own specialist bots (Diplodoctor for a medical report, Causius for a
legal letter) sitting in the same list.

The screens themselves are kept in
[`docs/research/grok-bot/`](../../research/grok-bot/README.md), ninety-four
of them with an index of what each batch shows, so a later reader can look at
the thing rather than at this description of it.

## Decisions

**D1. One home, one list.** `/companions/talk` is the talk home: the person's
companions, the companions they talk to, their group chats and the fleet's
bots in one list ordered by last activity, with the open chat beside it on a
wide screen and in its place on a phone. `/companions/<id>/talk` forwards
there. One row anatomy, one chat frame (chatkit's `ChatScreen` · `ChatThread`
· `Composer`), one details sheet. The old room component is gone.

**D2. A group chat is a room.** Three tables (`companion_rooms`,
`companion_room_members`, `companion_room_messages`), owner-only under RLS. A
member is exactly one of: a companion (`assistant_id`) or a fleet bot
(`fleet_slug`). A line keeps the member it came from and the name it had, so
the transcript still reads after a rename or a departure. Nothing in a room
writes `companion_memories`: what is said in a group is not a confidence
between one person and one companion.

**D3. Who answers is a round, bounded, one line per request.** The person's
message opens a round: the members addressed with `@Name` (or `@everyone`)
answer in order; with nobody addressed, one small model call names the one or
two members whose job it is, and failing that the first member answers, so a
room never goes silent. A bot that addresses another member queues it next.
A round is at most `MAX_BOT_TURNS` (6) lines, because two companions can
thank each other forever and every line is a model call. The API runs ONE
member per request and hands the rest of the round back to the client, which
brings it to the next call; the queue is re-checked against the room's real
members every time, so a forged queue cannot seat a stranger. This keeps
every request short on a phone, shows each voice as it lands, and lets the
person stop a round by not asking for the next turn.

**D4. The fleet's bots sit in the room over one contract, and are not
copied.** Diplodoctor and Causius each have their own rules about what they
may say, in their own repositories. The room does not restate any of that; it
asks the product:

    POST <live url>/api/ask  { messages: [{ role, content }], locale }
    → { text, replies? }

Which products answer at that path is `src/config/fleet-bots.ts`; what each
product IS (name, one line, live url) comes from the fleet map Loki publishes,
never typed here (fleet `AGENTS.md`: a page that types the portfolio is a
copy). Without the map there are no fleet bots on the rail and the rail says
so. A one-to-one chat with a fleet bot stays in the person's browser: the
product on the far side keeps nothing, and neither does OrangeCat. To seat
another product: give it `/api/ask` with that shape and add its slug.

**D5. A companion is made in a minute, and defined in chat.** "New companion"
asks for a name, a shape and a colour, nothing else. The face is an SVG served
by `/api/ai-assistants/avatar?shape=…&hue=…` and lives in `avatar_url` like
any picture; a companion without one wears the face its name picks
(`config/companion-avatars.ts`). Its definition is a starter that asks, in its
first message, what it should help with most; what the person answers is
remembered (companion memory, per person) and used in every later
conversation. The full form stays on the edit page. This is the one place the
fleet's chat differs from a form on purpose: the job is said once, to the
companion, not typed into a field.

## Not decided here, and why

**D6. Connectors ("Apps verbinden").** Grok Bot lists some 150 apps. Read
closely, every card is a plugin "for Cursor": one MCP server plus one skill
file, with a "view source" link. Those are published by the vendors themselves
(Stripe, Notion, Linear, Atlassian, Figma, Supabase and so on ship their own
MCP servers) or by the community; the marketplace is a catalogue, not 150
partnerships. The fleet's path is the same open standard: `ai-kit` gains an
MCP client, a catalogue of servers lives in one register, a companion gets
per-tool toggles ("the toggle is the honest control; the instruction is a
hope"), and anything that acts on the world goes through the approval pattern
the Cat already has (`cat_pending_actions`). OrangeCat is already on the other
side of this standard: it exposes `/api/mcp` to AI apps. This is a package
decision (fleet rule: packages first), not an app feature, so it is recorded
here and built there.

**D7. Routines and "always on".** A bot that runs on a timer spends a model
call with nobody asking. The fleet's standing rule (2026-09-25) is that a
free-tier key is spent only when a person deliberately asks. Routines need a
budget a person has chosen to spend (their own key, or paid credits) before
they are a feature; the room engine runs unchanged under a scheduler once
that exists.

**D8. Voice calls.** chatkit's composer dictates and its answers can be read
aloud; a full-screen call with a chosen voice and speed is a chatkit feature
to ask for there, so every product gets it at once.

**Seen and not built.** Beyond D6–D8 the screens show a model picker (Auto /
Fast / Expert / Heavy / Build), a library of the files and links shared in
chats, a kids mode, and bot settings where risky actions are checked against
the person's own written rules before they run. None is in scope here; each is
named in the research index so the next slice is cut from the whole shape.

## Consequences

- Every chat surface in OrangeCat's companions is chatkit; behaviour cannot
  drift from the Cat's.
- Adding a fleet bot is one slug, once its product answers at `/api/ask`.
- The round engine is pure and tested (`__tests__/unit/companions/rooms/`):
  mentions, planning, handoffs, the cap, and the sanitising of a client-held
  queue.
- A migration ships with source pins (`rooms/migration.test.ts`) so a later
  edit cannot quietly open a room to anyone but its owner.

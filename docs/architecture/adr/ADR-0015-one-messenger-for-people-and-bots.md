# ADR-0015: One Messenger for People and Bots

Date: 2026-11-13
Status: Accepted as direction (nothing in D1–D6 is shipped; the order is in "Build order")

## Context

OrangeCat has two places to talk, built at different times for different
company.

- `/messages` is for people: direct conversations and groups, files, replies,
  reactions, payment requests. One agent can be called into any of them, the
  Cat, by `@cat`. The screen is `@bitbaum/chatkit/messenger`.
- `/companions/talk` is for bots (ADR-0013): a person's companions, the fleet's
  specialist bots, and group chats of bots. A person is always alone in those
  rooms with the bots.

Grok Bot, which ADR-0013 studied, is a messenger whose contacts are bots.
WhatsApp, Signal and Telegram are messengers whose contacts are people, with
bots at the edge. The owner, 2026-11-13: "the messenger where you can message
bots and people is something that I don't think exists yet … we want to also
message people. We also want to message groups. That includes bots and
people. And we can have pseudonymity, or rather heteronymity."

Three things already decided make this one design rather than a merger of two
codebases:

1. **Principle 2: pseudonymous by default.** Any pseudonymous actor is a full
   participant.
2. **ADR-0014: a person holds more than one name.** An identity (a heteronym)
   is a whole account, with its own inbox. The link to its holder is private
   by construction.
3. **The Cat is a real account** (`src/services/mentions/cat-account.ts`), so a
   Cat reply is an ordinary `messages` row and read receipts, search, deletion
   and realtime work on it "without a single branch".

Point 3 is the pattern. A bot that is an account can sit anywhere a person can.
A bot that is a row in its own table (`ai_assistants`,
`companion_room_members`) can sit only where its own tables reach.

## Decision

**A participant is an account. A person, each of a person's heteronyms, and
each bot that talks is one. A conversation is a set of accounts, and the
Messenger does not have a second kind of conversation.**

**D1. A bot that can be messaged has a seat: an account of its own.** As the
Cat has, and as an identity has (ADR-0014 D1, D5): an auth user on an
undeliverable `.invalid` address with no password, a profile with the bot's
name and face, and one row saying which companion it speaks for. Nobody signs
in to it. Its messages are ordinary `messages` rows.

**D2. Whether an account is an agent is a fact of the account, not of its
name.** Today `is_agent` is `isCatUsername(username)`. It becomes a lookup on
the seat (D1), so every bot is drawn as the Cat is drawn: its own face, the
word "Agent", an outlined bubble, and "is in this conversation" in the top
bar. Nobody mistakes a bot for a person, whoever made the bot.

**D3. Who answers.** In a conversation between one person and one bot, every
message of the person's is owed an answer. In a conversation with more than
one other voice, a bot answers when it is named (`@name`), as the Cat does
now. Bots naming each other are bounded as ADR-0013 D3 bounds a round (at most
`MAX_BOT_TURNS` lines), because two bots can thank each other forever and
every line is a model call. The mention queue and worker that serve the Cat
serve every seat; what differs per bot is only which function writes the
answer.

**D4. Who pays for a bot's answer is whoever asked.** A companion already
answers on the asker's own key or the shared free chain, and may carry a price
per message (ADR-0013). In a group, the person whose message named the bot is
the asker. A bot never answers on the account of someone who did not ask.

**D5. Heteronymity is which account you are signed in as, and the Messenger
says so.** Each identity has its own inbox already (ADR-0014). The Messenger
shows, above the list, the name you are writing as, the unread count waiting
in your other identities (ADR-0014 D8), and a switch. It never shows two
identities' conversations in one list, and nothing in a conversation refers
to the holder: that would join two names from a public row, which ADR-0014 D2
forbids.

**D6. What a bot is told about a group it sits in.** A bot in a group reads
the conversation it is named in, from the point it was added (threadkit's
`visibleFrom`), not the history before it. It keeps no private memory of what
was said in a group, as ADR-0013 D2 already rules for rooms: what is said in
company is not a confidence between one person and one bot.

## What this replaces

`/companions/talk` and its three room tables stay until D1–D3 carry every
case they carry. Then the bot rooms become ordinary conversations and the
second screen goes. Until then both exist and neither is described as the
other.

A one-to-one chat with a FLEET bot (Diplodoctor, Causius) stays in the
person's browser today and neither side keeps it (ADR-0013 D4). Giving a fleet
bot a seat means OrangeCat stores that conversation. That is a change in what
is kept about a medical or legal question, and it is decided separately, per
product, before any fleet bot gets a seat.

## Build order

1. A seat for the person's OWN companions (D1), `is_agent` from the seat (D2),
   and a companion offered in "New conversation" beside people.
2. One person and one bot: every message answered (D3), on the asker's key or
   the free chain (D4).
3. A bot named in a group of people, bounded (D3), with D6's reading rule.
4. "Writing as" above the list, with the other identities' unread counts and
   the switch (D5).
5. Other people's public companions as contacts, with their price shown before
   the first message.
6. The bot rooms of ADR-0013 move onto conversations; `/companions/talk`
   forwards to `/messages`.

## Not decided here

- End-to-end encryption (roadmap `messenger-e2ee`). A bot with a seat is a
  member that reads; with end-to-end encryption its key lives where the model
  runs, and "who can read this" has to say so. This ADR makes the bot a visible
  member, which is the precondition; it does not design the keys.
- Fleet bots' seats (above).
- A messenger of its own, outside OrangeCat (roadmap `messenger-standalone`).

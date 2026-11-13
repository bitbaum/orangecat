# Cat Bot: parity with Grok Bot

**Cat Bot** is the name of OrangeCat's bot platform: the bots a person makes,
talks to and hands work to. Today it lives inside OrangeCat (`/companions`,
`src/services/companions/`). In time it becomes its own app, next to OrangeCat
and Loki, the way Grok Bot's app sits next to Grok and X. The code keeps the
word "companions" until that move; everything a person reads says Cat Bot.

The reference is Grok Bot as the owner photographed it on 2026-10-30
([`docs/research/grok-bot/`](research/grok-bot/README.md)) and what it does
today: a bot that can see and drive websites. What was taken from it, and why,
is [ADR-0013](architecture/adr/ADR-0013-companions-talk-together.md). This file
is the running scorecard and the plan for the first pair of working Cat Bots:
a **Developer** and a **QA**.

## The pair

- **Developer**: takes a job in chat, starts an agent session in the owner's
  Loki on the right project, follows the run to its answer and reports what
  shipped (the PR and its state).
- **QA**: opens the owner's live sites, walks them the way a visitor would,
  and files each defect it can show into the project's Loki feedback inbox,
  where the Developer, or anyone, picks it up.

Both run as their owner: every Loki call goes through the Loki account linked
to the owner (`services/loki/`), and a hand that starts work is confirmed by a
tap unless the owner switched it to "on its own" for that bot
(`hand-grants.ts`).

## Scorecard

State: **built** is on `main`; **in progress** has an open PR; **planned** has
a step in the plan below; **not planned** is a deliberate gap.

| Capability                                                      | Grok Bot                                             | Cat Bot                                                                                                                                                                                                                                                                                                                     | State       |
| --------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| One list of bots and group chats, newest first                  | yes                                                  | `/companions/talk` (#1474, #1496)                                                                                                                                                                                                                                                                                           | built       |
| A bot made in a minute; the job defined in chat                 | yes                                                  | name, shape, colour; the job becomes its definition (#1490)                                                                                                                                                                                                                                                                 | built       |
| Ready-made bots                                                 | yes                                                  | the shelf, `COMPANION_SHELF` in `src/config/companions.ts` (#1496)                                                                                                                                                                                                                                                          | built       |
| Group chats, @mentions, bot-to-bot handoff                      | yes                                                  | bounded at six bot turns a round (#1488, #1489)                                                                                                                                                                                                                                                                             | built       |
| Memory                                                          | yes                                                  | `services/companions/memory.ts`, at `/companions/[id]/memory`: read every line, add one yourself, correct one, forget one or all                                                                                                                                                                                            | in progress |
| Attachments in chat                                             | yes                                                  | #1480                                                                                                                                                                                                                                                                                                                       | built       |
| Actions proposed in chat, confirmed by a tap                    | rules-checked risky actions                          | hands: a "Do it?" card through the Cat's permission check and spend cap (#1500)                                                                                                                                                                                                                                             | built       |
| Your own rules, checked before a bot acts on its own            | rules-checked risky actions, custom rules, time zone | "Your rules for your bots" in a bot's details: one set per person, in every bot's prompt for its owner; a step a bot would run on its own is checked against them first and, on no or unsure, waits for a tap. Time zone set there too (`services/companions/rules.ts`)                                                     | in progress |
| Works on its own, with a switch per ability                     | yes                                                  | per-bot, per-hand "on its own" for Loki hands only (#1615)                                                                                                                                                                                                                                                                  | built       |
| Routines                                                        | yes                                                  | scheduled, repeating through the day, reach the owner's Telegram through Loki (#1526, #1618)                                                                                                                                                                                                                                | built       |
| **Developer:** send an agent a task and follow it to the answer | via connectors                                       | `send_task_to_loki`, `loki_run_status`, the follow loop (#1610, #1622)                                                                                                                                                                                                                                                      | built       |
| **Developer:** read how every project is doing                  | n/a                                                  | `project_status`, `loki_sessions` (#1616)                                                                                                                                                                                                                                                                                   | built       |
| **QA:** file a finding into a project's inbox and read it back  | n/a                                                  | `file_loki_finding`, `loki_finding_status` (#1613)                                                                                                                                                                                                                                                                          | built       |
| **QA:** headless browser testing of a site                      | yes                                                  | `walk_site`: up to three pages opened in Loki's browser at phone size; per page: loads, shows what it must, no sideways scroll, no broken picture; a failed page's picture is shown in the thread                                                                                                                           | in progress |
| **Computer use:** its own browser, seen and driven by the bot   | yes: sees and drives sites in its own browser        | `use_browser`: each bot has its own Chromium in Loki with its own cookies; one step at a time (open, click, type, press, scroll, back, look, close), each answered with a picture in the thread and the page in words with its elements numbered, so a model without vision can drive too. Never types a password or a card | in progress |
| Connectors (vendor MCP servers and skills)                      | ~150, OAuth per app                                  | OrangeCat serves `/api/mcp`; no catalogue (ADR-0013 D6)                                                                                                                                                                                                                                                                     | not planned |
| Voice and video calls                                           | yes                                                  | chatkit's to add (ADR-0013 D8)                                                                                                                                                                                                                                                                                              | not planned |
| Library: files and links shared in a chat                       | yes                                                  | "Library" in a bot's details, at `/companions/[id]/library`: the photos, files and links from your chats with it, and pictures its browser took, read from your own stored messages (`services/companions/library.ts`)                                                                                                      | in progress |
| Model picker                                                    | yes                                                  | "Model" in a bot's details: on your own key, the provider's own list of models for that key, chosen per bot on this device; on the shared pool the chain picks and the row says so                                                                                                                                          | in progress |
| One key across linked accounts                                  | no: a key is per product                             | A key saved in Loki can answer the same person's bots here. Settings → AI offers it ("Use my xAI key here"); the key stays on Loki, which makes the call for the linked account; off by default, switched off in either place                                                                                               | in progress |
| Plumbing made for the model                                     | yes, for Grok only                                   | A profile per model (`src/config/model-profiles.ts`): on your own key a bot's tools are offered in the provider's native function format where the model takes it, in prose where it does not; a provider that refuses the functions is asked once more in prose. Not yet on the shared free pool                           | in progress |
| Its own app next to OrangeCat and Loki                          | yes                                                  | inside OrangeCat for now                                                                                                                                                                                                                                                                                                    | later       |

## The plan

The order holds. A step that is already in progress is not held up by a step
added after it.

1. **QA headless browser testing.** In progress: `walk_site`. Chromium runs
   in Loki (its own guarded browser on the box: one at a time, private
   network refused), never in the OrangeCat web process. The hand takes one
   to three addresses and, optionally, phrases each page must show; Loki
   opens each at phone size and answers per page: it loads, shows what it
   must, does not scroll sideways, has no broken picture. The QA bot files
   each failure with `file_loki_finding`. The picture of a failed page is
   shown in the thread. A flow that needs clicks is walked with step 2's
   browser. This step lays
   the base step 2 builds on: a browser Loki owns, started and stopped per
   job, its output read back through the Loki rail.

2. **Computer use: a browser of its own for every Cat Bot.** Built on step 1's
   Playwright-on-runner base, right after it.
   - **One browser per bot.** Each Cat Bot gets its own headless Chromium on
     the Loki runner with its own profile directory: no cookies, storage or
     sign-ins shared with another bot, its owner's browser, or OrangeCat. A
     bot's browser is closed when idle and its profile goes with the bot.
   - **The API.** Four actions, each answered with a fresh screenshot so the
     bot sees the result of what it did: `navigate(url)`, `click(x, y)` or by
     visible label, `type(text)`, and `screenshot()`. They are Loki hands
     like the others: proposed in chat and confirmed by a tap, or run on
     their own only where the owner switched that hand on for that bot, and
     inside the work loop's step and time limits (`work-loop.ts`).
   - **Watched live from the app.** The bot's chat shows its browser as it
     works: the latest screenshot, refreshed while the bot is driving (a
     stream where the runner can serve one), so the owner sees what the bot
     sees and can stop it.
   - **Bounds.** No payment and no password entry on the bot's own
     initiative: a step that would pay, sign in or submit a form stops and
     asks the owner. Every action is a line of the
     thread, which is its record.

3. **Cat Bot as its own app.** The bots, their chats and their browsers move
   behind their own address next to OrangeCat and Loki, signing in with the
   same OrangeCat account. Not started; this file says what moves.

## Keeping this file true

A PR that changes a row's state updates the row in the same PR. A row is
**built** only once its PR is merged.

# Grok Bot, as seen on a phone (2026-10-30)

Ninety-four screenshots of xAI's Grok Bot and the Bots section of the Grok app,
taken by the owner on 2026-10-30 (German UI, Android). They are the source for
[ADR-0013 Companions talk together](../../architecture/adr/ADR-0013-companions-talk-together.md)
and the reference for what "a messaging app where the bots are the contacts"
looks like when it is done well. Downscaled to 480px wide so the folder stays
small; the originals are the owner's.

They are a third party's product. Look at them for the shape of a screen, the
rhythm of a list, the words a label uses; copy none of the art.

## What each batch shows

| Batch | Files             | Screens                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `01-01` … `01-20` | Grok Bot home: one list of bots and group chats, newest first, each row face · "Name · job" · last line · time. Settings (account, Premium, usage, appearance, language). "Connect apps" and device permissions.                                                                                                                                                                                                       |
| 2     | `02-01` … `02-20` | The connector catalogue: ~150 plugins, each a vendor-published MCP server plus a skill file ("created by Cursor"), with OAuth per app (the X sign-in flow).                                                                                                                                                                                                                                                            |
| 3     | `03-01` … `03-20` | New group chat (To: search, checkbox rows, Start). New bot: name, then a shape and a colour, the job defined later in chat. A 1:1 chat (Funes). Memory status. Voice-chat settings and the call feedback sheet.                                                                                                                                                                                                        |
| 4     | `04-01` … `04-18` | A group transcript with "Name · job" above every bot line. Group details: Routines, Library, Members ("Add member" as the last row). Edit the group avatar: generate or upload, "reset to the members' avatars". The Grok app sidebar with a Bots section. Settings: Connectors, Skills, Memory, Bot settings. Composer chip "Ask Handler".                                                                            |
| 5     | `05-01` … `05-16` | Voice and video mode, voice personalities, push-to-talk. The model picker (Auto / Fast / Expert / Heavy / Build). Composer suggestion chips (camera, documents, video, image edit, voice mode). Bot settings: automatic review of risky actions against the person's own rules, custom rules, time zone. Library: files and links shared in chats, by week. Routines empty state: "ask the bot in chat to set one up". |

## What we took, what we left

Taken, and why, is the ADR's job (D1–D8). The short form:

- **One list, one row shape, newest first** — built (`/companions/talk`).
- **Group chats with @mentions and bot-to-bot handoff** — built, bounded (six bot turns a round).
- **"Name · job" everywhere a bot speaks** — built.
- **A bot made in a minute: name, shape, colour; the job defined in chat** — built.
- **Members: add and remove from the details sheet** — built.
- **Connectors** — documented as MCP + skills, not built (D6). OrangeCat already serves `/api/mcp`.
- **Routines** — deferred: a scheduled bot spends a key nobody asked it to spend (D7).
- **Voice calls, model picker, library, kids mode, rules-checked risky actions** — not built; voice is chatkit's to add (D8), the rest is noted here so the next person sees the whole shape before picking a slice.

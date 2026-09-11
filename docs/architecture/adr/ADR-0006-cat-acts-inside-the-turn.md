# ADR-0006: Cat Acts Inside the Turn

Date: 2026-09-07
Status: Proposed

## Context

The ask: make Cat much smarter and much more powerful.

The instinct is to add actions. That is not the constraint. Measured today:

|                                               |                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------- |
| Actions in `CAT_ACTIONS`                      | **49**, every one `enabled`, every one handler-backed                |
| Categories                                    | entities 15, context 16, communication 8, payments 7, organization 3 |
| Function-calling tools (a _separate_ surface) | **8**                                                                |
| Static system prompt budget                   | **54,600** chars, of which the action catalog is only **5,303**      |
| Context budget                                | 28,000 chars across 20 sections                                      |
| Default permissions for a new user            | `context` only — everything else **off**                             |

Cat can already do a great deal. What it cannot do is **think**: it never sees
the result of anything it does, and the two things it can do — look something up
and change something — live in different mechanisms that cannot be combined.

### The shape of the ceiling

`chat-orchestrator.ts` runs a turn in this order:

```
tool phase (≤3 steps, read-only)  →  model writes the whole reply  →
parseActionsFromResponse(fullContent)  →  runExecActions(...)
```

Actions are scraped out of **finished text** and fired afterwards. The system
prompt is admirably honest about the consequence:

> "its result does NOT exist yet while you write — announce it as in progress…
> NEVER as already done."

So Cat cannot say "done", cannot check whether it worked, cannot react to a
failure, and cannot use one result to choose the next step. It is not an agent;
it is a text generator with a side effect stapled to the end.

Four more measured limits, each of which makes Cat look stupid in a way that is
not the model's fault:

1. **The two surfaces are disjoint.** The 8 tools (`search_platform`,
   `query_my_data`, …) are read-only and go through `tool-executor.ts`. The 49
   actions are write and go through `action-executor.ts` with permissions,
   spend caps and an audit log. Nothing can chain _search → decide → execute →
   verify_, because the halves do not meet.
2. **A hardcoded keyword list gates every tool.** `messageMightNeedTools()` is
   ~90 English substrings. "Why are you so slow?" matches nothing, so
   `check_cat_health` — written for exactly that question — never fires.
3. **Most providers get no tools at all, silently.** `tool-use.ts` returns the
   messages unchanged for any provider that is not Groq or OpenRouter, while
   the prompt states "You have access to tools" unconditionally. A BYOK
   Together/Ollama user has a Cat that believes it can search and cannot.
4. **`exec_action` parameters are never validated.** The registry declares
   `parameters[]` with names, types and required flags; the executor takes
   `z.record(z.string(), z.unknown())` and hands model JSON straight to the
   handler. Each handler re-checks ad hoc. This is what breaks first when the
   registry grows.

And one that is a live product bug rather than a design limit: **the local-model
path is given the same prompt and executes nothing.** `/api/cat/prepare` hands
the browser the full 49-action catalog; `/api/cat/local-complete` only calls
`saveMessages` — no parsing, no execution. A local Cat emits `exec_action`
blocks that are stored as literal text forever.

## Decision

### D1 — One surface. Every action is a tool.

Delete the text-scraping path. `CAT_ACTIONS` already carries everything a tool
definition needs — id, description, typed `parameters[]` — so tool schemas are
**generated from the registry**, not written twice. The 8 read tools join the
same registry as `category: 'read'` entries.

One registry ⇒ one permission check, one audit trail, one confirmation model,
one place to add a capability. Today `forget_memories` exists in both worlds and
its tool twin bypasses the permission service entirely; that class of divergence
becomes impossible rather than merely fixed.

### D2 — Act inside the turn, and feed results back. This is the whole ADR.

The loop becomes:

```
model → tool_call → execute (perms, caps, confirmation) → result → model → …
      → final text, written KNOWING what happened
```

Bounded: **≤8 steps**, one 25s wall clock, and the existing spend caps unchanged.
A step that needs confirmation suspends the loop and returns the pending card, as
now — the difference is that on confirmation the loop **resumes** instead of the
turn being over.

This is what "smarter" actually means here. It buys, with no new actions:

- "Did it work?" answerable in the same breath as "do it".
- Recovery: a failed create can be retried with a corrected slug, not reported.
- Chaining: _find the project → check it has a wallet → publish it_ is one turn.
- Truthful past tense. The prompt's "never say done" rule can be deleted,
  because Cat will know.

### D3 — Capability decides tools, not keywords. BUILT.

Delete `messageMightNeedTools` **as a gate**. The model decides whether it needs
a tool; that is what tool-calling is for, and a 90-word English list is both a
capability cliff and a non-English cliff.

Measured before removing it, against five ordinary requests: only "create a
project called X" got through (via the substring `create a`). "publish my
project", "sell my ebook", "list my mugs for sale" and "make me a service for
haircuts" were all blocked — four of five real phrasings never reached the tools
at all. Which also means the in-turn loop built in D2 was largely dormant: it
could only fire on messages the keyword list happened to like.

The function survives, demoted to **advisory**: it still drives the
`suggestUpgrade` hint in the done event, where a wrong guess costs a hint rather
than Cat's ability to act. The cost of removing the gate is one slim routing
round-trip on messages that turn out not to need a tool — the routing call
carries its own short prompt and `max_tokens: 1200`, not the main system prompt,
so D7 removes far more than this adds.

Providers that genuinely cannot call tools are handled by **telling the truth**,
which is now `actionsVia` (see D7): the prompt's action and tool sections are
rendered only where the resolved provider actually receives the definitions. A
Cat that says it can search should be able to search.

### D4 — Validate parameters at the boundary, from the registry.

Generate a Zod schema per action from the declared `parameters[]` and validate
before the handler. A missing required field becomes a typed rejection the model
can _see and correct_ on the next loop step — which only becomes useful once D2
exists, and which is what makes a larger registry safe.

### D5 — A first run that can do something. BUILT.

A new user's Cat has `context` only: it cannot create, message, or pay. It looks
broken, and the fix is buried in settings. Replace with an **inline grant** — the
first time Cat wants a capability it does not have, it asks in the conversation,
with the specific action named, and the grant applies from that turn on.

Most of this shipped as *grant-on-confirm* (`20260910203000_confirming_can_also_allow.sql`,
`canGrantOnConfirm` in `action-types.ts`): a denial for a non-payment,
non-high-risk action becomes a pending action with `grant_on_confirm`, the card
reads "Allow and confirm", and confirming grants the category (still
confirm-each-time). What was missing was the other half of the conversation:
`summariseForModel` told the model a plain "waiting for confirmation", so the
reply announced a done deal while the card asked for a permission the reply
never mentioned. It now says NOT YET ALLOWED, names the category, and says one
tap allows it. A hard denial names the category to allow instead of "tell the
user what to grant" with nothing to say.

Two corrections while in here, both measured: `update_profile` sat in the
default-on `context` category with `requiresConfirmation: false`, so a brand-new
user's Cat could rewrite their handle and bio with no grant and no confirmation —
it is now `entities` and requires confirmation, and reaches a new user through
the consent card. And the `settings` permission category had zero actions
referencing it: a dead switch in the permissions UI. Removed from the app; the
Postgres enum value is left orphaned (an enum value cannot be dropped in place,
and no row references it). The class is closed by a test: every category listed
must govern at least one enabled action.

Not built: the loop does not RESUME after confirmation — the card confirms, the
action runs, and a system message reports it; Cat does not get a follow-up turn
with the result. That is the remaining gap between D2's "resumes" and today.

### D6 — Cat can check its own work. BUILT.

`track-record.ts` already joins `cat_action_log` against current entity status
and settled payments to derive proposed → published → funded, plus setbacks.
It was context only. It is now also the read tool `check_my_track_record`
(zero arguments, no permission gate — it reads Cat's own log), answered as
prose by `formatTrackRecordForModel`, which names the pattern as a fact the
model must act on: _"3 things drafted, none published — offer to finish ONE of
them before creating anything new"_, _"2 published but nothing funded yet — the
gap is reach or pricing, not more listings"_, _"2 proposals the user never
confirmed — ask what held them back"_. The routing prompt scopes it to Cat's own
actions; the user's own numbers stay with `query_my_data`. A null record says
"could not be read — do not reconstruct it from memory", never "nothing yet".

### D7 — The prompt diet is a separate lever — and it is 3x bigger than estimated. BUILT.

This decision was written with an estimate of **5,303 chars saved**, which made it
look like a rounding error worth deferring. Measured on 2026-09-10, the real
figure is **18,871 of 54,253 chars — 34.8% of everything sent on every
message**, or 3.6x the estimate. The estimate counted only the action catalog; it
missed that both `##` sections carry their `###` sub-sections with them,
including the generated `buildActionCatalogAppendix()` listing of every action
that has no prose section of its own.

The two sections are `Actions You Can Execute Directly` and `Tools You Can Call`.
Since D1/D4, `action-schemas.ts` ships exactly that registry as JSON Schema tool
definitions — so on any provider that receives them, the prose is every enabled
action a second time, in English.

Built as `actionsVia: 'tools' | 'prose' | 'none'` on `buildCatSystemPrompt`:

- `tools` — definitions are sent, prose dropped. 54,253 → 35,382 chars.
- `prose` — no native tools, so the `parseActionsFromResponse` text path is
  Cat's only verb and the envelope must be described. **The default**, so a
  caller that says nothing gets byte-for-byte what it got before.
- `none` — nothing downstream executes anything. This is D8.

One fact decides it: `TOOL_CAPABLE_PROVIDERS` in `config/ai-provider-runtime`,
which the tool layer now branches on too. It used to be spelled out separately in
each place, and when they disagreed the prompt won the argument — the user was
told an action had run on a path that was never given the tools to run it.

**This does not fix the Groq ceiling.** 35,382 chars now fits the ~39,808-char
budget with ~4,400 to spare — but user context, memories, history and the page
excerpt are all appended on top of that, and they routinely exceed it, so Cat
still overflows platform Groq in practice and still runs on OpenRouter's shared
free pool. It buys a third of the way there and makes the rest reachable. `SECTION_SELECTION_ENABLED` — per-turn trimming, already built and
switched off for want of free-model eval capacity — remains the lever that
closes it, as its own piece of work.

A consequence worth stating, since a later reader will trip on it: on the `tools`
path the main call receives no tool definitions at all (they go on the action
loop's own slim prompt), so stripping the catalog means the main model no longer
emits `exec_action` — every action goes through the loop. That is D2 working as
designed, and the loop offers every enabled action. It also means `Critical Rules` still tells
the model to announce actions as in-progress ("the result appears below"), which
is true on the `prose` path and stale on the `tools` path, where the result is
already known before the reply is written. Left alone deliberately: it errs
toward under-claiming, and rewriting a shared rule per-path is its own change.

### D8 — Stop the local path from lying. BUILT.

`/api/cat/prepare` builds the prompt for a model running in the user's own
browser (Ollama / LM Studio), and the only thing that comes back is
`POST /api/cat/local-complete`, which calls `saveMessages`. There is no executor
on that path, so an `exec_action` block is stored verbatim and the user reads
"Creating that now…" for something nothing will ever create.

Of the two options, the second: the route passes `actionsVia: 'none'`, which
drops the catalog **and** replaces it with a section stating plainly that nothing
written can change anything, with instructions to name the exact page instead.
Removing the catalog without saying why would have been half the fix — a model
with no catalog still improvises an envelope.

Running the real loop against a local model stays the better end state and is not
blocked by this; it is just a larger piece of work, and until it exists the honest
prompt is the one that admits the limit.

## What this is not

**Not more actions.** 49 is plenty and the registry is healthy; the constraint is
that Cat cannot see, chain, or verify. Adding a 50th action to a system that
fires blind makes it more dangerous, not smarter.

**Not a bigger model.** The failures above are structural. A frontier model
inside a parse-and-fire loop still cannot see its own results.

## Order

1. **D4 + D1** — registry-generated schemas and one surface. Safe, mechanical,
   and the precondition for everything else.
2. **D2** — the loop. The step that changes what Cat is.
3. **D3 + D7 + D8** — stop lying about tools, on every path. ✅ DONE.
   D7 turned out to *depend* on D3 rather than being independent of it: the
   keyword gate blocked four of five ordinary action phrasings ("publish my
   project", "sell my ebook", "list my mugs for sale", "make me a service for
   haircuts" — only "create a project called X" got through), so the tool
   definitions the diet relies on were rarely being sent at all. Cutting the
   prose first would have removed Cat's verb. They ship together.
4. **D5** — the first run.
5. **D6** — self-knowledge.
6. **Section selection** — MECHANISM BUILT, flag off pending the eval.
   Two things were found by trying to enable it. First, nothing anywhere
   produced a `turnDescriptor`, so the env flag was a double gate that changed
   nothing when set; `services/cat/turn-descriptor.ts` now builds one in
   chat-prepare from facts the caller has (the message, whether history is
   empty, the page and entity). Second, selection ran BEFORE the capability
   strip, so flag-on + `actionsVia: 'none'` + a greeting threw — selection had
   already removed an instruction section the strip then demanded. Strip now
   runs first. Measured 2026-09-11 on the tools path (base prompt, before
   few-shot text): unselected 32,019; a first-message greeting 23,097; a
   pricing question 18,824. To enable: `CAT_PROMPT_SECTION_SELECTION=1` in the
   box's runtime `.env`; the nightly `orangecat-cat-eval.timer` (04:30 UTC) is
   the gate, failing under 7/8 on either axis.

## Related

- ADR-0005 — unclaimed pages; Cat's verb for that flow arrives naturally once
  the loop exists, since "set up X for Y" becomes a chain rather than a
  bespoke action.

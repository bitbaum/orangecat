# ADR-0008: Capability Is a Property of the Model, Not a List of Providers

Date: 2026-09-11
Status: Proposed

## Context

OrangeCat's thesis is that any identity is a full economic participant, and its
Cat is meant to be the best agent we can build. A user who brings a frontier API
key, or runs a capable model on their own hardware, should get the _most_
capable Cat we can offer them. They are the users who have already paid for the
capability; the platform's own free tier is the constrained case, not theirs.

Measured today, the opposite is true. **The stronger your model, the weaker your
Cat.**

| What the user brings                                 | What Cat can do                        |
| ---------------------------------------------------- | -------------------------------------- |
| platform free tier (Groq / OpenRouter)               | web search, read a page, 49 actions    |
| **their own OpenAI / Together / DeepSeek / xAI key** | **chat only — no tools, no actions**   |
| **a strong local model (Ollama, LM Studio)**         | **chat only — nothing is even parsed** |

Two lines cause it.

**`TOOL_CAPABLE_PROVIDERS = ['groq', 'openrouter']`**
(`src/config/ai-provider-runtime.ts`). `maybeEnrichWithSearchResults` returns
the messages unchanged for any other provider, so a BYOK user on GPT-class or
Claude-class models — every one of which speaks OpenAI-style function calling —
is handed no tool definitions at all. Since ADR-0007 that includes `web_search`
and `read_page`: the user paying for the best model is the one Cat cannot look
anything up for.

**`/api/cat/local-complete` is 52 lines and calls only `saveMessages`.** There
is no parser and no executor on the local path, so a local model's Cat executes
nothing. ADR-0006 D8 made this _honest_ — the prompt now tells a local model it
cannot change anything — which was the right immediate fix and is not the end
state.

### Why this is the same bug as the rest of this codebase's history

A hand-maintained list standing in for data the system can already derive. The
repo has paid for that pattern repeatedly: a 90-word keyword gate deciding
whether tools were needed (ADR-0006 D3, blocked four of five real phrasings), a
route-surface three-list drift, an auth gate pinning prefixes rather than
deriving receivers. Each time the fix was the same shape: ask the data.

The data exists **on both sides already**:

- `src/config/ai-models.ts` carries per-model `capabilities`, including
  `function_calling` and `vision`.
- `@bitbaum/ai-kit/registry` carries `toolProtocol` from a **live probe**, with
  `unprobed` as an explicit third value and a `toolCapable()` helper that
  refuses `none`. Five of nine free models answer tools only via a text
  protocol, which a provider-level boolean cannot express at all.

## Decision

### D1 — Ask the model, not the provider. BUILT.

Replace `providerSupportsNativeTools(providerId)` with a model-level capability
lookup. A model may drive the tool loop when its registry row says
`function_calling`, or when a live probe says it speaks a tool protocol.

Three states, not two, because this is the same three-answer shape as
ADR-0007's search: **can** (send native tool definitions), **text-protocol
only** (send the text envelope), and **unprobed** (treat as incapable and say
so, rather than silently sending definitions a model will ignore). A model that
cannot drive tools must make the prompt say so — `actionsVia: 'none'` already
exists for exactly this, from ADR-0006 D7.

The win is immediate and needs no new capability: every BYOK user on a
function-calling model gets web search and the 49 actions they are already
paying a frontier provider for.

**The engine half is built**: `@bitbaum/ai-kit/capability` (bitbaum/ai-kit#48)
ships the classification, the plan, the TTLs and the credential scoping, with
the asymmetry that a positive is cheap and a negative is sticky. Storage and
wiring stay here.

#### Two findings from starting the wiring, because D1 is not the one-line change it reads as

**Absence from a hand-maintained list must mean `unobserved`, never `none`.**
`config/ai-models.ts` flags `function_calling` per model. The tempting
implementation reads "no flag" as "no tools" — and that reproduces this ADR's
own bug one layer down, because the registry is incomplete by construction and
a model it has never heard of would be permanently denied tools without ever
being asked. Only an observation may produce `none`. A registry says where to
start, never where to stop.

**The tool loop could not reach a BYOK credential at all.** Three facts
together, any one of which alone would have been fixable:

- `tool-use.ts` does its own raw `fetch` and knew how to build exactly two
  endpoints, Groq and OpenRouter.
- `provider-resolver.ts` bakes the user's key into a constructed `aiService`
  and returned no endpoint or key, so the loop had nothing to call with.
- `AiService.chatCompletion` returns `{ content, … }` and **drops `tool_calls`
  entirely**, so routing the loop through the existing abstraction cannot work
  either — the tool call is thrown away at the seam.

**Taken via the resolver route (recommended over widening `AiService`, which
touches every implementation and runs a refactor through a path that also
carries spend caps and metering).** `ChainStep` now carries
`{ toolEndpoint, toolKey }` — the only place a BYOK key exists in the raw —
and `ResolvedProvider` surfaces the active step's pair. `userGroqKey` is
deprecated in place: it could only ever carry a Groq key, which is exactly why
a user's own OpenAI key bought them nothing.

#### Two things the existing gate caught, both worth more than the feature

`actions-via-wiring.test.ts` pinned capability to the provider list. Updating it
was not a formality; it surfaced the more serious half of the bug.

**`actionsVia` and the tool loop must be the same question.** The loop was
changed to ask the model while `actionsVia` — which decides what the SYSTEM
PROMPT claims Cat can do — still asked the provider. Two answers to one
question is the original failure wearing new clothes: a user gets told an action
ran on a path that was never handed the definitions. Both now call
`toolPlanForModel`, and the gate asserts neither reverts.

**No endpoint fallback, ever.** The first cut kept a provider-name fallback for
callers that passed no credentials. It reads as harmless and is not: it
recreates the second, drifting list this decision deletes, and a wrong guess
sends a user's own model id to somebody else's vendor with somebody else's key
— a more expensive failure than sending no tools. The endpoint now comes only
from the resolver, and the gate forbids a `PROVIDER_BASE_URLS` guess returning.

Nine tests then failed because they called the loop without credentials. That is
the correct new behaviour, so they supply them — which also makes them mirror
production instead of leaning on ambient environment variables.

#### Three bugs this change introduced and then fixed, all the same shape

Recorded because the shape is the point: every one was a second derivation of a
fact that already existed somewhere, which is the thing this ADR exists to stop.

**`chain[0]` is not the active step.** A metered frontier request REPLACES the
primary wholesale and leaves the chain behind as its fallbacks. Reading the
credentials off `chain[0]` meant that on exactly the paid path, the tool loop
would call whichever vendor the user had configured first, with that vendor's
key, while the answer came from platform OpenRouter. It reads `primary` now, and
the replacement step carries its own pair.

**The platform chain is four vendors, not two.** `buildPlatformProviders` can
return Together and a **local Ollama** as well as Groq and OpenRouter. A
provider-name mapping that handled the two obvious ones would post a Together
model id to OpenRouter — and a LOCAL model to a paid vendor. The fix was not a
better mapping: `PlatformProvider` now publishes the `{toolEndpoint, toolKey}`
it already computed to build `aiService`, and the resolver copies it. One
derivation, no second list.

**A removed positional argument that TypeScript could not see.** Deleting the
now-dead `groqKey` parameter left six call sites passing a key where
`modelToUse` now sits. Every parameter is a string, so `tsc` was perfectly
happy and the tests were quietly wrong. Found by reading the call sites, not by
running the typechecker. **A green typecheck is not evidence that the right
argument reached the right slot.**

#### Optimism without memory is a permanent outage, not a probe

D1 says an uncatalogued model is ASKED, and that a wrong negative is worse than
a wasted request. Both still hold. What was missing is that the ask has to be
remembered, and the reason is sharper than "it would be nice to learn".

`actionsVia: 'tools'` does not mean "tools are available". It means **the prose
action catalogue was DROPPED because definitions replace it** (ADR-0006 D7). So
for a model that cannot do tools, the optimistic path is not merely wasteful —
each turn sends definitions the vendor rejects AND removes the only other way
Cat is told how to act. Cat ends the turn with no verb at all. With nothing
recorded, the next turn is identical. A model in this state is not slow to
learn; it never learns, and a user watching sees an agent that cannot do
anything and cannot say why.

One observation ends it. `tool-capability.ts` keeps what real traffic proved,
keyed by **model AND credential** — capability differs per key, and a negative
learned on one user's key must not silence Cat for everyone else on that model.
The loop asks the plan with that verdict, writes down what the response proved,
and `actionsViaForModel` reads the same verdict, so the wire and the prompt
cannot diverge. The asymmetry from `@bitbaum/ai-kit/capability` is unchanged: a
positive is cheap and immediate, a negative requires the vendor to NAME tools.

**In-process, deliberately.** A `Map`, bounded at 500 entries, oldest evicted.
It resets on deploy and is not shared between instances, which costs at most one
re-learning turn per model per process. That cost is real and far smaller than a
table and a migration for a fact this cheap to re-derive; the stored shape is
`ai-kit`'s `CapabilityRecord`, so promoting it to a table later is a change of
storage, not of rules.

#### The engine's own bar was set by a cost estimate that was wrong

`saysToolsUnsupported` carried eleven patterns and a note saying a false
negative "costs one request". Every pattern assumed a singular subject with
`is`, so `tools are not supported by this model` — the form vendors actually
send — matched nothing at all.

The gap and the note are the same mistake. Once the caller drops its prose
catalogue whenever definitions go out, an unrecognised refusal is not one
wasted request; it is the permanent outage above. The bar is unchanged and
still conservative — NAME tools or functions, NEGATE support, both halves
explicitly — but the grammatical variants now clear it, and both directions are
pinned: seventeen real refusals must match, thirteen unrelated 400s must not,
including the near misses `streaming is not supported for this model` and
`vision is not supported by this model` (bitbaum/ai-kit#51).

#### A gate that pinned formatting instead of wiring

`actions-via-wiring.test.ts` pinned the orchestrator's call as one exact line,
so wrapping the call across lines failed it while changing nothing — the kind
of failure that teaches whoever hits it to weaken the assertion. It now matches
against whitespace-collapsed source, which keeps the assertion about ARGUMENTS.

Proving it by mutation then caught a real hole. Asserting the shared prefix
`recordToolAttempt(modelToUse, toolKey` looked sufficient and was not: deleting
the SUCCESS call left the REFUSAL call satisfying it, and the mutant walked
through green. The two sites answer different questions — the refusal is the
only thing that can stop the loop re-sending; the success is what makes
`native` stick so a later 429 cannot demote a model we have seen use tools —
so both are now pinned by their own shape. **A gate is green until a mutant
proves otherwise.**

### D2 — The local path gets a real loop.

Run the same in-turn loop against a local model: the browser holds the model,
the server holds the permissions, spend caps and audit log. The seam already
exists — `/api/cat/prepare` builds the identical prompt — so what is missing is
the return leg: `local-complete` should parse and execute exactly like the
hosted path rather than only storing text.

This is the decision that makes "bring your own strong model" a first-class
path instead of a degraded one, and it is worth more than any new tool, because
it multiplies every tool that already exists.

### D3 — Capability is gated by what the model and the payer support, never by a global flag.

Build advanced capability now and ship it **off**, switched on per user by a
rule rather than by someone remembering a flag. The rule has two terms:

- **Can this model do it?** From D1's capability set — tools, vision,
  long context.
- **May this user have it?** From the machinery that already exists:
  `model-access.ts` (`free | byok | credits`), `checkFrontierAccess`, credit
  metering, the autonomy ladder, permission categories.

A capability is then a row, not a branch. "On for BYOK and paying users, off on
the free tier" stops being a policy someone has to implement per feature.

### D4 — Computer use: build it gated, and the gate is not money.

Revised from ADR-0007's framing, which leaned on cost. Cost is the weakest of
the objections and BYOK dissolves it: a user on a frontier key or a strong local
model has already paid for the steps and the vision.

What BYOK does **not** dissolve is the boundary. `read_page` is safe because Cat
may only open a URL the user wrote or a search produced — a bound on reach, not
a filter on intent. A keyboard removes that bound: it turns "fetch a URL I
chose" into "type anything, anywhere, including into a form that moves money".
Every page Cat reads is untrusted text written by strangers, and computer use
gives that text a much larger lever.

So it is built behind D3's gate, requires a vision-and-tools model, requires an
explicit per-user grant, and — the part that is actual work — needs its own
allow-list analogue: an enumerated set of origins and actions, not a free
desktop. Sequenced after D1/D2 because those multiply what already exists,
while this adds a capability whose output nobody can yet verify.

### D5 — Show the work.

Cat already streams tool activity live (`onToolCall` → SSE `tool_call` →
`ToolCallChip`), which is the surface other assistants are recognised for. Two
gaps, both from ADR-0007 D1:

- `web_search` and `read_page` have no entries in `TOOL_LABELS`, so they render
  as a generic "Working… / Done (6)" instead of naming the query or the page.
- **Citations are opaque.** The turn assigns `[F1]`-style handles and nothing
  renders them, so a reader sees a bare token instead of a link to the source.
  The handle must travel in the tool-call event (`ToolCallResultRef` gains it)
  rather than being inferred client-side from result order — the turn dedupes
  repeated URLs while handles do not, so an order-based guess would link the
  wrong source, which is precisely the failure the citation machinery exists to
  prevent.

Legibility is not decoration here. Every capability added in ADR-0007 produces
evidence, and none of it is checkable by the person reading the answer.

## Consequences

- One capability SSOT, asked by every caller. The provider list stops being a
  second, silently-diverging source of truth about what a model can do.
- A free-tier user's experience is unchanged; a BYOK or local user's changes
  substantially, in the direction their payment already implied.
- `unprobed` must be treated as incapable. A model assumed capable and silently
  ignoring tool definitions is the failure this ADR is trying to end, not a
  cheaper version of it.

## Order

1. **D1** — ask the model. ✅ BUILT. Smallest change, largest immediate effect.
2. **D5** — show the work. Small, and it makes D1's effect visible.
3. **D2** — the local loop.
4. **D3** — the gate, once there are two capabilities to gate.
5. **D4** — computer use, behind all of the above.

## Related

- ADR-0006 — `actionsVia` and `TOOL_CAPABLE_PROVIDERS`; this ADR generalises the
  capability SSOT that decision introduced, and finishes D8's honest-but-inert
  local path.
- ADR-0007 — the web tools whose reach D1 extends and D5 makes legible.

# ADR-0008: Capability Is a Property of the Model, Not a List of Providers

Date: 2026-09-11
Status: Proposed

## Context

OrangeCat's thesis is that any identity is a full economic participant, and its
Cat is meant to be the best agent we can build. A user who brings a frontier API
key, or runs a capable model on their own hardware, should get the *most*
capable Cat we can offer them. They are the users who have already paid for the
capability; the platform's own free tier is the constrained case, not theirs.

Measured today, the opposite is true. **The stronger your model, the weaker your
Cat.**

| What the user brings | What Cat can do |
| --- | --- |
| platform free tier (Groq / OpenRouter) | web search, read a page, 49 actions |
| **their own OpenAI / Together / DeepSeek / xAI key** | **chat only — no tools, no actions** |
| **a strong local model (Ollama, LM Studio)** | **chat only — nothing is even parsed** |

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
nothing. ADR-0006 D8 made this *honest* — the prompt now tells a local model it
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

### D1 — Ask the model, not the provider.

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

1. **D1** — ask the model. Smallest change, largest immediate effect.
2. **D5** — show the work. Small, and it makes D1's effect visible.
3. **D2** — the local loop.
4. **D3** — the gate, once there are two capabilities to gate.
5. **D4** — computer use, behind all of the above.

## Related

- ADR-0006 — `actionsVia` and `TOOL_CAPABLE_PROVIDERS`; this ADR generalises the
  capability SSOT that decision introduced, and finishes D8's honest-but-inert
  local path.
- ADR-0007 — the web tools whose reach D1 extends and D5 makes legible.

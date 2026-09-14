# ADR-0009: The Model Is Yours — Any Endpoint, No Content Layer

Date: 2026-09-14
Status: Accepted (D1, D2 built; D3 policy; D4 direction)

## Context

A hosted assistant answers "I can't provide that" and the person asking has no
recourse: the model, its rules, and its price were all chosen by someone else.
OrangeCat's thesis is the opposite — any identity is a full participant, and
the Cat works for the person, not for a vendor. For that to be more than a
slogan, the model behind the Cat has to be the user's choice, all the way down
to a model nobody but the user controls.

Measured on 2026-09-14, before this ADR, it was not:

| What the user brings                          | Reachable? | Why                                                   |
| --------------------------------------------- | ---------- | ----------------------------------------------------- |
| platform free pool                            | yes        | `buildPlatformProviders`                              |
| a key for Groq / OpenRouter / OpenAI / …      | yes        | six vendors in `PROVIDER_BASE_URLS`                   |
| Ollama or LM Studio on the laptop             | partly     | browser-only, two hard-coded localhost ports          |
| **vLLM, llama.cpp, LiteLLM, a remote Ollama** | **no**     | `user_api_keys` had no column for a URL               |
| **a model the user trained or fine-tuned**    | **no**     | same — no way to say where it is or what it is called |

The transport was never the problem. `OpenAICompatibleService` has taken
`{ apiKey, baseUrl, providerId }` since 2026-06. The row could not carry a
URL, the API refused any provider outside a closed enum, and the form had no
field. "Any model" meant "any of six vendors we spelled out".

The platform itself adds no content layer. There is no moderation filter, no
prompt or reply screening, no blocklist anywhere in `src/services/cat/` or
`src/app/api/cat/`. What a turn may say is decided by the model that serves it
and by the person asking. That was already true; it was not written down, and
it was not reachable for a model the platform did not list.

## Decisions

### D1 — The user's own endpoint is a provider. BUILT.

`user_api_keys` gains nullable `base_url` and `default_model`
(`20260914120000_a_key_can_name_its_own_endpoint.sql`). A row with
`provider = 'custom'` (`CUSTOM_PROVIDER_ID`) carries the URL of any
OpenAI-compatible server and the model it should serve. The resolver builds a
chain step from the row — its URL, its model, its (possibly empty) key — and
points the tool loop at `${base_url}/chat/completions`, so a self-hosted model
gets web search and actions on exactly the same path as a vendor key
(ADR-0008 D1: capability is asked of the model, never of a provider name).

The key is optional. vLLM and llama.cpp ship with no auth; demanding a made-up
token teaches people to paste junk. An empty key sends **no** `Authorization`
header (`bearerHeaders`), and is a credential the chain must keep: two no-auth
servers dedupe on `(url, key)`, not on the key.

The URL is fetched from OrangeCat's server, so it passes the same SSRF gate as
a webhook target (`checkPublicUrl`): public http(s) only, never loopback,
RFC1918, link-local or cloud metadata. A box on the user's own network is the
browser's job — "Run locally" — not the server's. The endpoint is validated at
`${base_url}/models`, the one route every OpenAI-compatible server answers,
and the list it returns fills a default model the user did not name.

### D2 — Every surface derives from one list. BUILT.

`WIRED_PROVIDER_IDS = [...WIRED_VENDOR_IDS, CUSTOM_PROVIDER_ID]`. The key
schema, the resolver's provider union, the settings form, `allowsCustomModel`
in the picker and the pricing copy all read it. `PROVIDER_BASE_URLS` covers
exactly the vendors, and a test asserts the custom provider is wired without a
fixed host — because it has none, by construction.

### D3 — No content layer, and no pretending. POLICY.

OrangeCat does not filter prompts or replies and will not add a platform
policy on what the Cat may say. The rules in a turn are the model's and the
user's. Do not add moderation middleware; do not wire a feature to a single
vendor's policy surface.

What this does and does not promise, stated plainly on every surface that
mentions it:

- A hosted vendor's model keeps that vendor's rules. OrangeCat cannot make
  Groq or OpenRouter answer what they decline to. What it guarantees is the
  **route**: the same Cat, the same tools, pointed at a model the user runs.
- Neutrality is architectural, not legal cover. What a person does with a
  model's output is still their responsibility under the law where they are.
- "Uncensored" is a property of a model and where it runs, never a claim
  OrangeCat makes about its free pool.

### D4 — Price is pass-through plus a stated margin; the lever is owning compute. DIRECTION.

- **BYOK and your own endpoint: zero markup.** OrangeCat never sees the bill.
- **Cat Credits: raw provider cost × `CREDIT_USAGE_MARKUP`** (1.4 today, the
  number and its reasons in `credit-metering.ts`). This is the platform's
  only revenue on intelligence; P2P payments stay at 0% (`cat-plans.ts`).
- **The free pool and Supporter plan track the cost of compute.** Vendor
  prices are the floor under both, so the only durable way down is to own the
  inference — `PLATFORM_OLLAMA_URL` is the seed of that: a platform-run
  server already sits in the chain, and the same `custom` mechanics that let a
  user point the Cat at their box let the platform point it at its own.

## Consequences

- "Any model" is now a tested property, not a paragraph: a row naming a URL
  becomes a step, a no-auth server keeps the tool loop, and the schema refuses
  a custom row without a URL.
- The onboarding wizard stays vendor-only (it collects one key and nothing
  else); the user's own endpoint is added in Settings → AI.
- `ai_assistants.compute_provider_type = 'self_hosted'` remains inert: an
  `ai_assistant` entity still resolves only OpenRouter or Groq. Closing that
  is the next ADR, and it should reuse this row shape rather than invent one.
- The browser-side local path still knows two localhost ports. A user-set
  local URL belongs with "Run locally", not with server-side keys, and is not
  built here.

## Related

- ADR-0008 — capability is asked of the model; this ADR is why that question
  can now be asked of a model no registry lists.
- `docs/development/ai/MODEL_SYSTEM.md` — the sovereignty ladder, with the
  new rung.
- `docs/architecture/CAT_CREDITS.md` — the Bitcoin-paid rung and its margin.

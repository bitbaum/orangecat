---
created_date: 2026-01-18
last_modified_date: 2026-09-14
last_modified_summary: Added the "your own endpoint" rung — any OpenAI-compatible server the user names (ADR-0009); corrected the BYOK provider list to what the code actually wires.
---

# AI Model System - Complete Guide

**Status:** Implemented

---

## Overview

OrangeCat's AI model system is **effortless for beginners** and **powerful for advanced users**.

**The golden rule:** users can start chatting with My Cat immediately, without any setup or configuration.

The system runs on a **sovereignty ladder**:

| Rung              | Pays              | Pseudonymous? | Whose rules? | For                              |
| ----------------- | ----------------- | ------------- | ------------ | -------------------------------- |
| Free (managed)    | nobody            | yes           | the vendor's | everyone, baseline               |
| Cat Credits       | OC, in Bitcoin    | yes           | the vendor's | most upgraders                   |
| BYOK              | provider directly | no (card)     | the vendor's | power users                      |
| Your own endpoint | you (your server) | yes           | yours        | vLLM, llama.cpp, a trained model |
| Local (browser)   | nobody            | yes           | yours        | Ollama / LM Studio on the laptop |

See `docs/architecture/CAT_CREDITS.md` for the Bitcoin-paid frontier rung and
`docs/architecture/adr/ADR-0009-the-model-is-yours.md` for why the last two
rungs exist: OrangeCat adds no content layer of its own, so the model you
choose — and where it runs — is the only policy in the turn.

---

## User Experience

### For non-technical users (default)

1. Sign up to OrangeCat.
2. Open My Cat chat.
3. Start talking immediately.

A free model is auto-selected, no configuration is needed, and no conversation
content is persisted on the ephemeral path. The daily free-message allowance is
**database-driven** (`ai_platform_usage.daily_limit`), not hardcoded — surfaced
to the client as `freeMessagesPerDay` / `freeMessagesRemaining`.

**Default free model:** `DEFAULT_FREE_MODEL_ID` (`openai/gpt-oss-120b:free`).
The platform provider chain (see below) can also answer on Groq's
`llama-3.3-70b-versatile` when it leads the chain.

### For power users (optional upgrade)

1. **Cat Credits** — pay OrangeCat in Bitcoin/Lightning, spend on frontier
   models. No card, no per-provider account. (`docs/architecture/CAT_CREDITS.md`)
2. **BYOK (Bring Your Own Key)** — an OpenRouter key unlocks 200+ models; or add
   a direct key for Groq, OpenAI, Together, DeepSeek or xAI
   (`WIRED_VENDOR_IDS`). Anthropic and Google keys are not wired direct —
   OpenRouter fronts both.
3. **Your own endpoint** — any OpenAI-compatible server you run, reached from
   OrangeCat's server: vLLM, llama.cpp, a remote Ollama, LiteLLM, or a model
   you trained yourself. Provider id `custom`; the row carries `base_url` and
   `default_model`; the key is optional. Same chain, same tool loop.
4. **Local (browser)** — Ollama or LM Studio on the laptop, called from the
   browser. Nothing leaves the machine.

---

## Technical Architecture

### Model registry (SSOT)

**Location:** `src/config/ai-models.ts` — `AI_MODEL_REGISTRY`.

This is the single source of truth for every curated, platform-served model:
pricing, context window, capabilities, tier, and free-vs-paid status. Tiers are
`free | economy | standard | premium` (`MODEL_TIERS`).

```typescript
export const AI_MODEL_REGISTRY: Record<string, AIModelMetadata> = {
  'openai/gpt-oss-120b:free': {
    id: 'openai/gpt-oss-120b:free',
    name: 'GPT-OSS 120B (Free)',
    provider: 'OpenAI',
    tier: 'free',
    isFree: true,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    // ...more metadata
  },
  // ...
};
```

**Compatibility adapter:** `src/config/model-registry.ts` exposes the legacy
`MODEL_REGISTRY` shape, but it is a thin **projection generated from
`AI_MODEL_REGISTRY`** — never a second hand-maintained list. New code should read
`ai-models.ts` directly.

Helper functions (all in `ai-models.ts`):

- `getModelMetadata(id)` / `getRegisteredModelId(id)` — resolve provider-reported
  snapshot ids (e.g. `...-20260708`) back to the registered model.
- `getModelDisplayName(id)` — never surface a raw slug in the UI.
- `getModelsByTier(tier)`, `getAvailableModels()`, `getFreeModels()`.
- `calculateCostBtc(id, inputTokens, outputTokens, btcPriceUsd)` — registry-based
  cost estimate (fallback for metering).

### Provider services

Each provider is a small service class with a shared `chatCompletion` /
`streamChatCompletion` interface so the resolver can swap implementations:

- `src/services/ai/openrouter.ts` — `OpenRouterService` (BTC cost tracking;
  prefers OpenRouter's returned `usage.cost`).
- `src/services/ai/groq.ts` — `GroqService` (ultra-fast free tier).
- `src/services/ai/openai-compat.ts` — `OpenAICompatibleService` (OpenAI,
  Together, DeepSeek, xAI, Ollama, LM Studio — anything OpenAI-wire-compatible).

### Platform provider chain

**Location:** `src/services/ai/platform-providers.ts`.

For non-BYOK users, `buildPlatformProviders(message)` composes an ordered chain,
first available wins and the rest become rate-limit fallbacks:

1. **Groq** — fastest inference, generous free tier.
2. **OpenRouter** — the free model pool (one entry per free model).
3. **Together AI** — backup free pool.
4. **Platform Ollama** — Hetzner-hosted small model, sovereignty backstop.

Each is enabled by the presence of its env var, so the chain shrinks gracefully.

### Provider resolution

**Location:** `src/services/cat/provider-resolver.ts`.

`resolveProvider(...)` builds the merged, fully-ordered chain: per-request header
keys → stored BYOK keys (user order, including `custom` rows aimed at the
user's own URL) → the platform chain. It also decides
whether a request is a **credit-metered frontier** call and returns the primary
service plus an ordered `fallbacks[]`.

### Chat endpoint + orchestration

**Endpoint:** `POST /api/cat/chat` (`src/app/api/cat/chat/route.ts`) — a thin
wrapper: auth + rate limit + body validation.

**Orchestrator:** `src/services/cat/chat-orchestrator.ts` (`orchestrateCatChat`)
owns provider resolution, context/memory, tool use, the model call with the
rate-limit fallback chain, streaming vs non-streaming responses, persistence, and
the post-response Cat Credits debit.

See `docs/reference/api/chat.md` for the request/response contract.

---

## Cost tracking & Cat Credits metering

- `OpenRouterService.chatCompletion` / `streamChatCompletion` return `costBtc`.
  It **prefers OpenRouter's real per-request `usage.cost`** (converted USD→BTC),
  and falls back to `calculateCostBtc` (registry token pricing) when the field is
  absent (older responses, non-OpenRouter providers).
- Free models always meter to `costBtc: 0`.
- For credit-paid frontier requests, the orchestrator calls
  `meterCreditUsage(...)` (`src/services/cat/credit-metering.ts`) with the real
  `rawCostBtc` when available. The debit is `rawCost × CREDIT_USAGE_MARKUP`,
  rounded up to 1e-8 BTC. Ledger metadata records `pricingSource` as
  `provider_reported` or `registry_estimate`.
- BYOK usage is never metered to Cat Credits (the user pays their provider).

---

## Model selection logic

### Priority

```
1. User specifies a concrete model  → use it (BYOK trusts any OpenRouter model)
2. User has BYOK                     → auto-select across allowed models
3. Free tier                         → auto-select from free models only
4. Fallback                          → DEFAULT_FREE_MODEL_ID
```

### Auto-router

**Location:** `src/services/ai/auto-router.ts`.

`createAutoRouter().selectModel({ message, conversationHistory, allowedModels })`
scores message complexity and picks a tier, then the cheapest suitable model
within it. It is also used to order the OpenRouter free pool per request.

---

## Current roster (refreshed 2026-07-08)

Prices are per 1M tokens (input / output), verified against live OpenRouter /
provider pages.

### Free tier (rate limited: 50/day free accounts, 1000/day with $10+ credits)

- `openai/gpt-oss-120b:free` — GPT-OSS 120B (default free model)
- `openai/gpt-oss-20b:free` — GPT-OSS 20B
- `meta-llama/llama-3.3-70b-instruct:free` — Llama 3.3 70B
- `meta-llama/llama-4-scout:free` — Llama 4 Scout (multimodal, huge context)

### Economy

- `meta-llama/llama-3.1-8b-instruct` — $0.02 / $0.03
- `openai/gpt-oss-120b` — $0.03 / $0.15
- `deepseek/deepseek-v4-flash` — $0.09 / $0.18 (1M context)

### Standard

- `qwen/qwen3-32b` — $0.08 / $0.28
- `anthropic/claude-sonnet-5` — $2 / $10 (intro pricing through 2026-08-31)

### Premium

- `anthropic/claude-opus-4.8` — $5 / $25 (1M context)
- `anthropic/claude-fable-5` — $10 / $50 (1M context)

> Keep this list in sync with `AI_MODEL_REGISTRY`. The registry is authoritative;
> this section is a human-readable snapshot.

---

## API key security

**Three tiers, default is ephemeral:**

1. **Free tier** — the server uses its own provider key; the user never sees or
   pays for it.
2. **Ephemeral BYOK** — the user's key is sent per-request in a header, never
   stored.
3. **Encrypted storage** — opt-in convenience; keys are encrypted at rest.

---

## Adding a new curated model

1. Add an entry to `AI_MODEL_REGISTRY` in `src/config/ai-models.ts` (id, name,
   provider, tier, pricing, context, capabilities, `isFree`).
2. If it needs a new provider transport, add it to
   `src/services/ai/openai-compat.ts` (or a dedicated service) and wire it into
   `provider-resolver.ts` / `platform-providers.ts`.
3. That's it — the legacy `MODEL_REGISTRY`, tier UIs, auto-router, and selectors
   all read from the SSOT automatically.

---

## References

- **Registry (SSOT):** `src/config/ai-models.ts`
- **Legacy compat adapter:** `src/config/model-registry.ts`
- **Provider services:** `src/services/ai/{openrouter,groq,openai-compat}.ts`
- **Platform chain:** `src/services/ai/platform-providers.ts`
- **Provider resolver:** `src/services/cat/provider-resolver.ts`
- **Auto-router:** `src/services/ai/auto-router.ts`
- **Chat orchestrator:** `src/services/cat/chat-orchestrator.ts`
- **Chat endpoint:** `src/app/api/cat/chat/route.ts`
- **Cat Credits metering:** `src/services/cat/credit-metering.ts`
- **Cat Credits design:** `docs/architecture/CAT_CREDITS.md`

---

**Remember:** the goal is **instant AI access** for everyone, with optional
Bitcoin-paid and BYOK power features for those who want them.

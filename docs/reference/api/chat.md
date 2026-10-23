# My Cat Chat API

**Created**: 2025-12-09
**Last Modified**: 2026-10-22
**Last Modified Summary**: Added the answer feedback loop — thumbs posted to `POST /api/chat/feedback`, the day's transcripts served to the fleet's reviewer by `GET /api/chat/review-export`.

## Overview

The Chat API powers **My Cat**, OrangeCat's AI assistant. Requests run through a
provider chain (Groq → OpenRouter free pool → Together → Ollama) for free-tier
users, or through the user's own key (BYOK) / Cat Credits for frontier models.
Model metadata is sourced from `src/config/ai-models.ts` (`AI_MODEL_REGISTRY`).

The ephemeral path does **not** persist conversation content; when a
`conversationId` is supplied, messages are saved to the user's conversation.

## The answer feedback loop

Under every Cat answer sit chatkit's thumbs (`@bitbaum/chatkit` 0.14,
"The feedback loop"). A thumb up, or a thumb down with a reason and a few
words, is posted to `POST /api/chat/feedback` (`{conversationId, messageId,
verdict, reason?, text?}`, signed in, rate limited) and kept in `chat_feedback`
beside the conversation — insert-only for the person, no read through the API
keys. Each night Loki fetches `GET /api/chat/review-export?since=<ISO>&limit=50`
with `Authorization: Bearer <CHAT_REVIEW_TOKEN>` (the one value shared across
the fleet's apps on the box; 401 on a wrong token, 503 while it is unset) and
receives `{ product: "orangecat", scope, transcripts }`: the scope is derived
from Cat's own system prompt and tool list (`src/services/cat/chat-review-export.ts`,
never typed twice), and the transcripts are the conversations updated in the
window — never temporary chats — newest first, at most 50, each at most 30
turns of at most 4000 characters with the tool steps Cat took, a `failed`
flag on a turn that died, and the thumbs. No names, emails, user or actor ids
leave with them. Loki judges every answer against the scope and files each
gap into its feedback inbox, where the fix is built.

## Authentication

All requests require an authenticated OrangeCat session (`withAuth`). There is no
unauthenticated public chat endpoint.

## Endpoint

### POST `/api/cat/chat`

Send a message to My Cat and receive a response (buffered JSON or streaming SSE).

#### Request

```javascript
POST /api/cat/chat
Content-Type: application/json

{
  "message": "How does OrangeCat work?",
  "model": "auto",              // optional: registry id, "auto", or "any"
  "stream": false,               // optional: true → SSE stream
  "conversationId": "<uuid>",   // optional: omit for the default conversation
  "preferredCurrency": "CHF",   // optional runtime hint
  "locale": "de-CH",            // optional runtime hint
  "lastVisitedPath": "/discover" // optional runtime hint
}
```

Optional BYOK headers (per-request, never stored):

- `x-openrouter-key: sk-or-...`
- `x-groq-api-key: gsk_...`

#### Parameters

| Parameter           | Type    | Required | Description                                                       |
| ------------------- | ------- | -------- | ----------------------------------------------------------------- |
| `message`           | string  | Yes      | The user's message (see `AI_MESSAGE_MAX_CHARS`).                  |
| `model`             | string  | No       | Registry model id, `"auto"`, or `"any"`. Defaults to auto-select. |
| `stream`            | boolean | No       | When `true`, response is an SSE stream.                           |
| `conversationId`    | uuid    | No       | Target conversation; omitted → the user's default conversation.   |
| `preferredCurrency` | string  | No       | Runtime hint for price quoting.                                   |
| `locale`            | string  | No       | Runtime hint for reply language.                                  |
| `lastVisitedPath`   | string  | No       | Runtime hint for recent-page awareness.                           |

#### Response — non-streaming (200)

Uses the standard API envelope (`{ success, data }`):

```javascript
{
  "success": true,
  "data": {
    "message": "OrangeCat is a Bitcoin-native platform...",
    "actions": [ /* parsed exec_action blocks, if any */ ],
    "quickReplies": [ "Tell me more", "Show me projects" ],
    "execResults": [ /* results of executed actions, if any */ ],
    "toolCalls": [ /* tool lifecycle events, if any */ ],
    "prefillProposals": [ /* prefilled entity form drafts, if any */ ],
    "modelUsed": "openai/gpt-oss-120b:free",
    "provider": "openrouter",
    "suggestUpgrade": false,
    "fallback": null,
    "usage": {
      "inputTokens": 320,
      "outputTokens": 210,
      "totalTokens": 530,
      "apiCostBtc": 0,
      "isFreeModel": true,
      "usedByok": false
    },
    "userStatus": {
      "hasByok": false,
      "freeMessagesPerDay": 25,
      "freeMessagesRemaining": 18
    }
  }
}
```

#### Response — streaming (200, `text/event-stream`)

When `stream: true`, the endpoint emits Server-Sent Events. Each event is a
`data: <json>` line. Notable payloads:

- `{ "model": "...", "provider": "..." }` — active model/provider (sent again on fallback).
- `{ "content": "..." }` — an incremental token chunk.
- `{ "tool_call": { ... } }` — a tool lifecycle event.
- `{ "prefill_proposal": { ... } }` — a prefilled entity form draft.
- `{ "fallback": { "from": "...", "to": "...", "model": "...", "reason": "rate_limit" } }` — provider swap before content streamed.
- Final: `{ "done": true, "usage": { ... }, "model": "...", "provider": "...", "actions": [...], "execResults": [...], "quickReplies": [...], "suggestUpgrade": false }`.
- On failure: an `event: error` line followed by `data: { "error": "...", "code": "..." }`.

#### Error responses

**400 Bad Request** — invalid body (fails `catChatBodySchema`):

```javascript
{ "success": false, "error": "Invalid request", "details": { /* zod flatten */ } }
```

**429 Rate Limited** — write-tier rate limit or all providers exhausted. Includes
standard rate-limit headers; non-streaming errors use codes such as
`AI_RATE_LIMITED` or `ALL_PROVIDERS_DOWN`.

**500 Internal Server Error**:

```javascript
{ "success": false, "error": "Failed to generate response" }
```

## Rate limiting

- Uses the **write-tier** per-user rate limit (`rateLimitWriteAsync`).
- Standard rate-limit headers are applied to responses:
  - `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`.
- Free-tier users additionally have a **daily message allowance**
  (`ai_platform_usage.daily_limit`), surfaced as `freeMessagesRemaining`.

## Cost & metering

- Free models report `apiCostBtc: 0`.
- Paid frontier models served on the platform key are metered to **Cat Credits**,
  preferring OpenRouter's real `usage.cost` and falling back to registry token
  pricing. See `docs/architecture/CAT_CREDITS.md`.
- BYOK requests are never metered to Cat Credits (the user pays their provider).

## Security

- Provider/API keys are handled server-side; BYOK header keys are ephemeral and
  never persisted.
- Input is validated at the boundary (`catChatBodySchema`).
- Raw provider error messages are never echoed to the client (they can contain
  credentials); errors are logged server-side and returned as structured codes.

## Usage example

```javascript
const response = await fetch('/api/cat/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'What is Bitcoin crowdfunding?' }),
});

const { data } = await response.json();
console.log(data.message, data.modelUsed);
```

## References

- **Endpoint:** `src/app/api/cat/chat/route.ts`
- **Orchestrator:** `src/services/cat/chat-orchestrator.ts`
- **Provider resolver:** `src/services/cat/provider-resolver.ts`
- **Model registry (SSOT):** `src/config/ai-models.ts`
- **Model system guide:** `docs/development/ai/MODEL_SYSTEM.md`

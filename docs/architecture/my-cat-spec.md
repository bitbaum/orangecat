# My Cat – Conversational Entry for Orangecat

created_date: 2026-01-18  
last_modified_date: 2026-06-03  
last_modified_summary: Chat-first Cat hub — full-height composer, minimal toolbar, context/controls as secondary panels; shell chrome via `getRouteChrome`.

Status: Draft (MVP shipped), Iterating

## 1) Vision

Make creation on Orangecat conversational. Users describe what they want (voice or text), and My Cat proposes the right entity and pre-fills the form so publishing is quick, private, and approachable. Power users choose any model (local or remote), while defaults are safe and simple.

## 2) Scope (MVP → Near-Term)

- Private chat (no persistence) with model selection and free/BYOK tiers.
- Local runtime support (Ollama / OpenAI-compatible like LM Studio).
- Voice entry: browser mic fills composer input; future option for local Whisper endpoint.
- “Turn thought into entity”: intent detection + prefill for Service (extendable to Products/Projects).
- Assistant ecosystem remains separate for public/monetized assistants.

## 3) UX Flows

- My Cat (Private) — `/dashboard/cat`:
  - **Default = chat only** (ChatGPT-style): full viewport height, composer pinned to the bottom, no hub tabs or status cards on the main screen.
  - **Toolbar**: model selector, links to Context (`?tab=context`) and Controls (`?tab=settings`); sidebar auto-collapses and mobile bottom nav hides on this route (`getRouteChrome` in `src/config/routes.ts`).
  - **Secondary panels**: context and settings are separate full-page views with “Back to chat”, not competing tab chrome.
  - Select Local or Remote model (BYOK/free). Badge: “Private · not saved”.
  - Mic captures speech (Web Speech API) and inserts transcript into composer (planned).
  - “Create Service from chat” CTA performs prefill and opens create wizard.

- Assistants (Public/Monetized):
  - Browse assistants, chat with usage/price transparency, and optional BYOK model selection.
  - History persists by design; monetization applied via existing flow.

- Global Voice Entry (Design Pattern):
  - Reusable VoiceInput UI to drop near any field or composer.
  - Entity Suggestion chip appears when the description implies an entity.

## 4) Architecture & Modularity

- SSOT & DRY:
  - Entities: `src/config/entity-registry.ts` and `CreateEntityWorkflow` + `EntityForm` + guidance/templates.
  - Models: `src/config/ai-models.ts` + `ModelSelector`.
  - Navigation: `src/config/navigation.ts`.

- Separation of Concerns:
  - UI: `CatChatPanel` handles local/remote switch, voice input, and CTA.
  - Providers: Local (browser → localhost) vs Remote (OpenRouter via API) are pluggable.
  - API: `/api/cat/chat` mediates OpenRouter access and enforces free-tier for non‑BYOK.
  - Prefill: `localStorage` transfers structured data into the create workflow with no server coupling.

- Data Flow (Private Chat, Remote):
  UI → `/api/cat/chat` → OpenRouter → Response → UI → (Optional) Prefill → `CreateEntityWorkflow`.

- Data Flow (Private Chat, Local):
  UI → Local runtime (Ollama / LM Studio) → Response → UI → (Optional) Prefill → `CreateEntityWorkflow`.

## 5) Security & Privacy

- Private by Default: My Cat does not persist chat content on the server.
- BYOK Keys: Stored encrypted at rest (AES‑256‑GCM). Roadmap includes a “Do not store keys” mode using client‑side encryption with a passphrase and localStorage.
- Local Mode: No server involvement. Requests go from browser to `localhost`; ensure CORS is enabled.
- Rate Limiting: General IP‑based for MVP; consider per‑user limit for private chat.
- Threat Model (MVP):
  - Key disclosure risk mitigated by encryption at rest and RLS.
  - No content at rest for private chats.
  - Local mode avoids server and keys entirely.

## 6) Implementation

- Navigation: “My Cat” item under Home.
- API: `POST /api/cat/chat` (OpenRouter, BYOK/free, ephemeral)
  - Per-user rate limiting, SSE streaming, and runtime client-provided key support via `OPENROUTER_KEY_HEADER` (`x-openrouter-key`).
- UI: `CatChatPanel` – model selector, local settings, mic input, entity CTA.
- Prefill: `service_prefill` in localStorage consumed by Service create page.

## 7) Configuration

- Local Provider (in-browser):
  - Key: `cat_local_provider` JSON: `{ enabled, provider, baseUrl, model }`.
  - Providers: `ollama` (chat API), `openai_compatible` (`/v1/chat/completions`).

- Environment:
  - OpenRouter key (platform): `OPENROUTER_API_KEY`.
  - Encryption: `API_KEY_ENCRYPTION_SECRET` (BYOK at-rest encryption).

## 8) Voice Entry Everywhere (Design Plan)

- Component: `VoiceInput` (future)
  - Props: `onTranscript(text)`, `lang`, `size`, `ariaLabel`.
  - Implementation: Web Speech API; feature-detect; fallback to instructions.
  - Accessibility: Clear state (listening/not), focus management.

- Integration Points:
  - Composers (timeline/messages), Create forms (description fields), onboarding description.
  - Entity Suggestion: lightweight classifier/heuristics (or small LLM call) to propose entity types.

## 9) Testing

- Local Mode: Health check badge; successful round-trip to local runtime (Ollama/LM Studio).
- Remote Mode: Free-tier enforcement (non‑BYOK), BYOK model selection, rate-limit paths.
- Prefill: CTA → `service_prefill` written → create page consumes and clears.
- Voice: Mic adds transcript; handles unsupported browsers gracefully.

## 10) Accessibility & i18n

- Buttons and toggles use titles/labels and have visible focus.
- Screen readers announce listening state and errors.
- Future: i18n for system strings; `lang` prop on voice input.

## 11) Performance

- Streaming enabled for both remote (SSE via `/api/cat/chat`) and local (Ollama/OpenAI-compatible event streams).
- Local mode minimizes latency; remote mode can use auto-router for cost/perf tradeoffs.

## 12) Roadmap

- “Do not store keys” (client-only encryption) mode.
- Optional local Whisper endpoint, with mic capture → local transcription.
- Expand entity prefill to Products/Projects; extraction helpers per entity type.
- Fine‑tune per‑user rate limits and quotas.

## 13) References

- Implementation guide: `docs/my-cat-voice-and-local-models.md`
- Entities & workflow: `src/components/create/`, `src/config/entity-registry.ts`
- Models & providers: `src/config/ai-models.ts`, `src/services/ai/openrouter.ts`

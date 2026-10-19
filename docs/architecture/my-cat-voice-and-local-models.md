My Cat: Voice Entry, Local Models, and Entity Prefill

Overview

- Purpose: Enable private, fast, and flexible data entry via voice and text, turning thoughts into Orangecat entities with minimal friction.
- Scope: “My Cat” private chat, local model support, BYOK for remote models, voice input, entity suggestion and prefill, and how these integrate with existing SSOT/DRY/SoC architecture.

Principles

- Privacy-first: Default to no server-side storage of chat content; prefer local execution when possible.
- SSOT + DRY: Reuse model registry (`src/config/ai-models.ts`), entity registry/workflow, and navigation configs.
- Separation of concerns: UI (CatChatPanel) is thin; API integration is isolated; prefill uses existing CreateEntityWorkflow.
- Pluggable providers: Support local runtimes (Ollama/LM Studio), OpenRouter (BYOK or platform), future Whisper endpoint.

User Experience

- Entry points: “My Cat” in sidebar → private chat; Assistant marketplace for monetizable assistants remains separate.
- Voice entry (MVP): Mic button uses browser Web Speech API to fill the composer; no audio leaves the device.
- Local models: Toggle “Local”; set provider (Ollama/OpenAI-compatible), base URL, and model (e.g., mistral). A health badge shows connectivity.
- Remote models: If Local is off, use OpenRouter; non-BYOK uses free models and daily limits; BYOK enables full catalog.
- Turn chat into entity: “Create Service from chat” extracts title/description heuristically and opens the Service create wizard prefilled.

Key Files

- Navigation: `src/config/navigation.ts` (adds “My Cat” under Home).
- Private chat API: `src/app/api/cat/chat/route.ts` (OpenRouter; BYOK; free-tier enforcement; ephemeral, no persistence).
- UI panel: `src/components/ai-chat/ModernChatPanel/` (it replaced the earlier `CatChatPanel`; voice input is in `components/ChatInput.tsx`).
- Service prefill: `src/app/(authenticated)/dashboard/services/create/page.tsx` (reads `service_prefill` from localStorage into CreateEntityWorkflow).

Architecture

- Chat modes:
  - Local: Browser → localhost (Ollama or OpenAI-compatible). No keys, no server calls, private by design.
  - Remote: Browser → `/api/cat/chat` → OpenRouter (BYOK if provided, otherwise platform key limited to free models).
- Model selection:
  - UI uses `ModelSelector`; server validates/enforces free models for non-BYOK.
  - Local mode bypasses server and calls local runtime directly.
- Entity prefill pipeline:
  - Source: Latest chat turn(s) → heuristic extraction (title from first sentence; description from last user msg).
  - Transport: Stored in `localStorage` under `service_prefill` and consumed by CreateEntityWorkflow.
  - Target: Unified `EntityForm` + guidance + templates.

Security & Privacy

- Chat privacy: The private Cat chat endpoint does not persist conversation content. Only platform usage counters may be incremented (non-BYOK).
- BYOK keys: Stored encrypted-at-rest (AES-256-GCM). Optionally, a “do not store keys” mode can be added (client-side encryption with passphrase and localStorage, just-in-time decryption for requests).
- Local mode: All traffic stays on the device (browser → localhost). Ensure the local runtime has CORS enabled and is bound to localhost.
- Voice privacy: Web Speech API (browser) keeps audio local to the browser vendor’s implementation. For fully offline STT, we can add a local Whisper HTTP endpoint configuration.

Configuration

- Local provider settings (persisted in-browser): key `cat_local_provider`
  - `enabled`: boolean
  - `provider`: `"ollama" | "openai_compatible"`
  - `baseUrl`: e.g., `http://localhost:11434`
  - `model`: e.g., `mistral`
- Service prefill: key `service_prefill` (JSON) consumed on `/dashboard/services/create`.

APIs

- POST `/api/cat/chat`
  - Request: `{ message: string, model?: string }`
  - Auth: Required. Rate limited.
  - Behavior: Chooses model (BYOK = any; non-BYOK = free-only + daily limit); returns `{ message, modelUsed, usage, userStatus }`. No chat text persisted.

Local Runtime Integrations

- Ollama (chat): POST `{ baseUrl }/api/chat` with `{ model, stream: false, messages: [...] }`. Reply content from `message.content`.
- OpenAI-compatible (LM Studio): POST `{ baseUrl }/v1/chat/completions` with `{ model, messages, stream: false }`. Reply from `choices[0].message.content`.

Voice Input

- MVP: Browser Web Speech API
  - Pro: Zero infra, private, fast.
  - Con: Browser dependent; not available in all environments.
- Optional (future): Local Whisper endpoint (e.g., whisper.cpp server)
  - UI: Add endpoint URL, language/model. Test button like local model settings.
  - Flow: Browser captures mic, posts audio blob to local endpoint → get transcript → insert to composer.

Consistency & Extensibility

- SSOT for models: `src/config/ai-models.ts` (tiers, pricing, capabilities) used across selector and APIs.
- DRY for forms: CreateEntityWorkflow + EntityForm + guidance/templates.
- Pluggable providers: Local vs OpenRouter selection is encapsulated in CatChatPanel; API stays unchanged for remote.
- Future entities: Add “Create X from chat” with minimal changes (new prefill mapping and CTA).

Accessibility

- Keyboard: Enter to send; buttons have titles; input focus states.
- Labels: “Private — not saved” and BYOK/free badges for clarity.
- Mobile: Controls use touch-friendly sizes; settings in collapsible section.

Testing

- Local mode: Health check button must reflect target runtime; message send should append assistant message.
- Remote mode: Non-BYOK enforces free model and daily limits; BYOK accepts selected model.
- Prefill: CTA writes `service_prefill` and page consumes it; verify fields prefilled.
- Voice: Mic click fills input with transcript; fallback message if API unsupported.
- Streaming: Remote responses update incrementally; local responses appear as a single message.

Known Limitations

- Rate limiting: Private chat uses per-user limiter; tune thresholds as usage grows.
- Whisper (offline): Not wired yet; requires optional local server.

Roadmap

- Add “Do not store keys” (client-only encryption) mode in settings.
- Add local Whisper endpoint config + test.
- Extend entity mapping beyond Services (Products, Projects, etc.).

Developer Notes

- UI: `src/components/ai-chat/ModernChatPanel/` holds the chat panel, including voice input.
- API: `src/app/api/cat/chat/route.ts` uses OpenRouter services, auto-router, and platform usage.
- Prefill: `src/app/(authenticated)/dashboard/services/create/page.tsx` reads and clears `service_prefill`.
- Navigation: `src/config/navigation.ts` adds “My Cat”.

Updates (2026-01-18)

- Streaming (remote): `/api/cat/chat` supports `stream: true` (SSE). Cat UI renders incremental assistant output.
- Per-user rate limit: Cat API uses `rateLimitWriteAsync(user.id)`.
- Client-provided key: Cat API accepts header defined by `OPENROUTER_KEY_HEADER` (`x-openrouter-key`, case-insensitive) to use a runtime OpenRouter key (not stored). Cat UI exposes a settings input and toggle.
- Voice input feature flag: Set `NEXT_PUBLIC_FEATURE_VOICE_INPUT=true` to enable mic buttons across forms and onboarding.

Enablement Checklist

- Set env vars:
  - `NEXT_PUBLIC_FEATURE_VOICE_INPUT=true`
  - Optional: `OPENROUTER_API_KEY=...` for platform remote usage
- For local models:
  - Ollama: `ollama pull mistral` (or other model), ensure CORS is enabled (default)
  - LM Studio: start server that exposes `/v1/chat/completions`
- In My Cat settings:
  - Local: toggle on, set provider/base URL/model, click Test
  - Remote: optionally paste an OpenRouter key (not stored) and switch on the toggle

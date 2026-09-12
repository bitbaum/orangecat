# Deployment Checklist (Orangecat)

Status: Ready for use

## 1) Environment Variables

- Required (App/Supabase)
  - `NEXT_PUBLIC_SITE_URL` – public site URL (https://example.com)
  - `NEXT_PUBLIC_SITE_NAME` – brand name
  - `NEXT_PUBLIC_APP_URL` – base URL used in Referer headers (OpenRouter)
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

- Rate Limiting (production)
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (canonical limiter)
  - `REDIS_URL`, `REDIS_TOKEN` (legacy until all routes migrate; point to Upstash values)

- AI / Voice
  - `OPENROUTER_API_KEY` (optional platform key; users can BYOK)
  - `NEXT_PUBLIC_FEATURE_VOICE_INPUT=true`

## 2) Security & Privacy

- Do not commit `.env.local`; production secrets live in `/opt/orangecat/app/.env` on the Hetzner box.
- Ensure HTTPS + HSTS; set CSP, COOP/COEP as appropriate.
- Verify no chat content is persisted in private chat; only usage counters for non‑BYOK.

## 3) Build & Test

- Run: `pnpm run type-check` (non‑blocking TS warnings may exist outside scope).
- Run: `pnpm run test:unit` (verify SSE/JSONL stream helper).
- Build: `pnpm run build` (Next.js production build).

## 4) Rate Limiting

- Canonical limiter configured (Upstash). Confirm envs are present.
- Check representative endpoints return `X-RateLimit-*` and `Retry-After` headers.
- Monitor Upstash dashboard for key usage.

## 5) AI Streaming

- Remote (OpenRouter): `/api/cat/chat` streams SSE; UI renders incrementally.
- Local (Ollama/LM Studio): Event-streams enabled; confirm incremental updates.
- BYOK header constant: `OPENROUTER_KEY_HEADER` (`x-openrouter-key`).

## 6) Self-Hosted Deployment (Hetzner)

- Node 24; `next build` / `next start` on the box (bitbaum), behind Caddy.
- Production env lives in `/opt/orangecat/app/.env` (no cloud dashboard).
- See docs/operations/deployment/DEPLOYMENT_PROCESS.md for the on-box flow.

## 7) Post‑Deploy Verification

- Health: `GET /api/health`.
- My Cat: `/dashboard/cat` – test remote (BYOK) and local streaming.
- Rate limits: Trigger 429 and inspect headers.
- Voice input: Confirm mic buttons visible (flag enabled) and functional.

## 8) Observability

- Enable logs/analytics; add RED/USE dashboards if applicable.
- Monitor 4xx/5xx rates and rate‑limit events.

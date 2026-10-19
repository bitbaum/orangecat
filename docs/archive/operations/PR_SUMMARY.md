# PR: My Cat streaming + Canonical Rate Limiting

Summary
- Enable streaming for My Cat with local and remote providers, unify rate limiting through canonical adapters and consistent headers, and add deployment/test hygiene.

Changes
- Streaming:
  - `src/lib/sse.ts`: `readEventStream` (SSE + JSONL)
  - `src/components/ai-chat/CatChatPanel.tsx`: local + remote streaming
- BYOK header SSOT:
  - `src/config/http-headers.ts`: `OPENROUTER_KEY_HEADER = 'x-openrouter-key'`
  - Updated code + docs to reference constant
- Rate limiting (canonical):
  - `src/lib/rate-limit.ts`: `applyRateLimitHeaders`, async write limiter
  - `src/lib/api/rateLimiting.ts`: adapters `enforceUserWriteLimit`, `enforceUserSocialLimit` (migration note added)
  - `src/lib/api/withRateLimit.ts`: applies headers on success, uses async write limiter
  - Migrated routes to adapters: cat/chat, ai-assistants (POST), ai-assistant messages, research (POST), research progress (POST), social follow/unfollow, wallets (POST), projects status (headers on success)
  - Shared handlers: `entityPostHandler`, `entityCrudHandler` now apply headers and use async write limiter
- Tests:
  - `__tests__/unit/utils/sse.test.ts` (active)
  - `__tests__/components/CatChatPanel.streaming.test.tsx` (enabled with UI mocks)
- Docs/Ops:
  - `docs/operations/DEPLOYMENT_CHECKLIST.md`
  - Updated my-cat docs to reflect streaming + header constant
  - Added `CHANGELOG.md`

Risk
- Low. Adapters preserve existing semantics; headers addition is additive.
- Streaming paths covered by unit and component tests.

Verification
- `npm test` passes (parser + component streaming tests)
- `npm run build` completes
- Local/remote streaming verified in UI
- Rate-limited endpoints return `X-RateLimit-*` + `Retry-After`

Env
- Set `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (canonical limiter)
- Optional: `REDIS_URL`, `REDIS_TOKEN` for legacy surfaces (during migration window)
- `OPENROUTER_API_KEY` (optional), `NEXT_PUBLIC_FEATURE_VOICE_INPUT=true`, and core Supabase envs

Follow-ups
- Resolve preexisting TS warnings (dashboard/auth/search)
- Prune legacy rate limiting functions after full migration per ADR-0002


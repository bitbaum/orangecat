# Cat and Loki agent reliability handoff

This runbook records the September 2026 reliability work and how to verify it. It concerns the chat agents at `/dashboard/cat` and `/loki`, not project dispatch or deployment of user sites.

## What changed

Loki's tool loop can take up to six rounds when each round adds useful work. It stops repeated tool calls and keeps its fact and grounding limits. The change is in `bitbaum/loki` PR #865, with the deterministic gate in `scripts/test/agent-tool-loop.ts`.

Cat's router now receives recent dialogue, so follow-up requests can refer to earlier turns. A provider failure before execution can move to the next configured model using that model's endpoint and key. Once a tool starts, the turn is never replayed on another provider: a write may have happened even if its response was lost. A single deadline bounds the phase. Completed tool results and their web evidence survive a later failure, while an unfinished call is marked unconfirmed in both the answer context and the visible tool chip. The code is in `src/services/cat/tool-use.ts`, `tool-turn-state.ts`, and `tool-routing-fallback.ts`.

## Local gates

- Loki: `pnpm run verify` and `npx tsx scripts/test/agent-tool-loop.ts` in `bitbaum/loki`.
- Cat: `pnpm run verify`; focused tests are `__tests__/unit/cat/tool-turn-reliability.test.ts`, `tool-routing-fallback.test.ts`, and `tool-use-bare-url.test.ts`.
- Keep the endpoint, model and credential together when changing provider resolution. Never retry a turn after a tool has started, especially an action tool.

## Production walk

1. Confirm the served Loki commit at `https://loki.orangecat.ch/api/health`; PR #865 merged as `4b9542c14e468246e6965a5a545e86d97b2c6213`. An authenticated `POST /api/loki` must return a real answer with `via`, `toolsUsed`, `rounds`, `retrieved`, and `grounding`. A question that cannot be verified should say so. HTTP health alone does not exercise the agent.
2. Confirm OrangeCat's exact served SHA from `/opt/orangecat/app/.release` on the box and compare it with the merged commit. `https://orangecat.ch/api/health` proves service health, not the release SHA.
3. Run the production Cat judgment harness from the box with `CAT_EVAL_NOTIFY=0` so a manual probe does not file an operator notification: `node /opt/orangecat/scripts/eval-cat.mjs` with the app's runtime environment loaded. It uses isolated test conversations, cleans them up, and reports entity choice, explanation, and duplicate drafts. The script is the source of truth for its inputs and thresholds.
4. In an authenticated Cat chat, test a follow-up that depends on the prior turn, then a tool request. Verify a visible tool result or an honest unfinished state. A production fallback probe needs an actual provider failure; do not infer it worked from a healthy primary-provider turn. Check the SSE `tool_call`, `prefill_proposal`, and final `done` frames.

If a check fails, keep the exact prompt, response status, served SHA, and tool events in the handoff. A green CI run or a merged PR does not establish the production behavior.

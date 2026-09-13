# Cat Fallback Chain — Reorder UI Verification (2026-06-15)

Production verification of the multi-key BYOK fallback chain with a
repositionable platform default (Settings → Cat AI). Tested live against
`orangecat.ch` (the box app reaches the self-hosted DB; a local boot cannot).

## Feature under test

The free OrangeCat default is a first-class, **repositionable** link in the
Cat fallback chain — placeable anywhere (including first/primary), interleaved
with the user's own keys, yet non-deletable. Order is stored in one 0-based
index space shared by `user_api_keys.sort_order` and
`user_ai_preferences.platform_chain_position`.

Related code: `src/services/cat/provider-resolver.ts` (merged chain),
`src/services/ai/api-key-service.ts` (`reorderKeys` with `'platform'` sentinel,
`getPlatformChainPosition`), `src/app/api/user/api-keys/route.ts` (PATCH),
`src/components/ai/AIKeyManager.tsx` (UI), `src/hooks/useAISettings.ts`.

## Method

1. Anonymous ("Try it anonymously") sign-in — no credentials/PII.
2. Seeded two dummy `user_api_keys` rows directly in the DB (real API keys are
   never entered into forms). Platform default left at position 0.
3. Loaded Settings → Cat AI; exercised the reorder controls.
4. Verified persistence in the DB; cleaned up all seeded rows afterward.

## Results — all pass

**Initial render** (platform at position 0):

| chain row              | state                                                      |
| ---------------------- | ---------------------------------------------------------- |
| OrangeCat free default | first; "Always on"; **no delete button**; Move-up disabled |
| Test Groq              | Primary, Valid; Move-up/down enabled; deletable            |
| Test OpenRouter        | last; Valid; Move-down disabled; deletable                 |

Styling is on the Loki semantic tier (monochrome surfaces, grip handle,
green status badges) — no chromatic/legacy tokens.

**Reorder** — clicked Move-down on the platform default. UI optimistically
reordered to `Test Groq → OrangeCat free default → Test OpenRouter` and the
PATCH persisted the merged index space exactly:

| entry                                            | persisted position |
| ------------------------------------------------ | ------------------ |
| groq key (`sort_order`)                          | 0                  |
| **platform default** (`platform_chain_position`) | 1                  |
| openrouter key (`sort_order`)                    | 2                  |

The PATCH route accepted the `'platform'` sentinel id and upserted a
`user_ai_preferences` row with `platform_chain_position = 1`. Confirms the
platform default is genuinely repositionable and persists where placed.

**Boundary behavior**: Move-up disabled on the first row, Move-down disabled on
the last row — correct.

**Native HTML5 drag** (grip handle) — verified bidirectionally:

| action                                | resulting persisted order            |
| ------------------------------------- | ------------------------------------ |
| drag platform default to the bottom   | groq 0, openrouter 1, **platform 2** |
| drag platform default back to the top | **platform 0**, groq 1, openrouter 2 |

The grip-handle drag fires the real `dragstart`/`drop` handlers, reorders
optimistically, and persists via PATCH — same end state as the arrow controls.
Also incidentally confirmed the page renders correctly in **light mode** (the
semantic migration holds in both themes).

## Not covered

- End-to-end _inference_ fallthrough (a key failing → next link serving) was not
  exercised here (dummy keys); resolver logic reviewed separately.

## Cleanup

Both dummy keys and the seeded preferences row were deleted (0 leftover). The
empty anonymous user remains (ephemeral, harmless).

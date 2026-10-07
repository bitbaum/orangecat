# Cat UI & Design SSOT Architecture

created_date: 2026-06-03  
last_modified_date: 2026-06-03  
last_modified_summary: Audit of globals.css, design tokens, and Cat module boundaries vs ChatGPT/Claude patterns

## Executive summary

OrangeCat has **three parallel design layers** that are only partly aligned. Cat chat was recently moved to a **chat-first layout**, but several **SSOT and DRY violations** remain—especially duplicate model registries and duplicate chat panel implementations. `globals.css` is large but **not a god file in the React sense**; the bigger risk is **drift** between CSS classes, TypeScript tokens, and stale markdown docs.

---

## 1. `globals.css` — role and verdict

| Aspect              | Assessment                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Size (~700 lines)   | Large, but typical for a Tailwind + PWA + mobile-first app                                                               |
| Responsibility      | CSS variables (`:root` / `.dark`), base resets, utility components (`.oc-*`), legacy form classes                        |
| God-file risk       | **Medium** — mixes tokens, marketing page utilities, PWA, and chat; hard to navigate                                     |
| SSOT for colors     | **Yes** for runtime theme — `--background`, `--tiffany-*`, etc. map to `tailwind.config.ts`                              |
| SSOT for components | **Partial** — `.oc-page*`, `.oc-surface*`, `.oc-chat-*` are the intended UI SSOT; many components still use raw Tailwind |

**Best practice (industry):** Design tokens in CSS variables + semantic component classes (`.oc-chat-composer`) + thin TS re-exports (`design-system.ts`) for programmatic composition (buttons in code).

**Gap:** `src/config/design-system.ts` (`COMPONENT_STYLES`, `UI_TOKENS`) is used by **Button/Input/Card** but **Cat chat does not use it**—chat uses `.oc-chat-*` in globals + inline Tailwind for send/stop buttons.

**Gap:** `docs/design-system/README.md` (June 2025) describes **old hex values and 12px card radius** that **do not match** current `globals.css` / x.ai-adjacent direction. Treat code as SSOT, not that README, until reconciled.

---

## 2. Three-layer design map (where to change what)

```
globals.css          → CSS variables + .oc-* layout/chat/page classes
tailwind.config.ts   → Maps variables to Tailwind utilities
design-system.ts     → TS class strings for shared UI primitives (buttons, fields)
cat-hub.ts           → Cat copy, tab URLs, agent name/badge
layout-chrome.ts     → Header height, full-height content below shell
routes.ts            → Route surfaces + getRouteChrome() (sidebar/nav on Cat)
ai-models.ts         → OpenRouter model SSOT (Cat + settings should use only this)
cat-actions.ts       → Executable action SSOT (permissions UI)
entity-registry.ts   → Entity create/nav SSOT (Cat action buttons)
```

---

## 3. Cat module map (SOC)

### Canonical user path: **My Cat** (`/dashboard/cat`)

| Layer     | Location                                       | Responsibility                                       |
| --------- | ---------------------------------------------- | ---------------------------------------------------- |
| Page      | `app/.../dashboard/cat/page.tsx`               | Auth, tab routing, composes toolbar + panel          |
| Toolbar   | `CatChatToolbar.tsx`                           | Agent identity, model picker, context/controls links |
| Chat UI   | `ModernChatPanel/`                             | Messages, composer, suggestions, pending actions     |
| Secondary | `CatSecondaryPanel.tsx`                        | Context & settings full-page views                   |
| Copy/tabs | `config/cat-hub.ts`                            | Strings, `CAT_HUB_TAB_HREFS`, `CAT_AGENT`            |
| Layout    | `config/layout-chrome.ts` + `getRouteChrome()` | Full-height below header                             |
| Styles    | `globals.css` `.oc-chat-*`                     | Chat-specific surfaces                               |

### Backend / domain (good separation)

| Layer        | Location                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| API          | `app/api/cat/*` (chat, history, actions, context, permissions, suggestions)                                  |
| Services     | `services/cat/*` (prompt, parser, executor, permissions, provider-resolver)                                  |
| Actions SSOT | `config/cat-actions.ts`                                                                                      |
| Types        | `types/cat.ts` (suggested actions; distinct from permission `CatAction` in cat-actions—**naming collision**) |

### Hooks

- `useChatMessages`, `useSuggestions`, `usePendingActionsManager` — chat state
- `useCatPermissions` — secondary panels
- `useAISettings` — keys/tiers (shared with `/settings/ai`)

---

## 4. Comparison to ChatGPT / Claude / Grok / Cursor

| Pattern                           | Reference products      | OrangeCat Cat today                                      |
| --------------------------------- | ----------------------- | -------------------------------------------------------- |
| Default screen = chat only        | ChatGPT, Claude         | ✅ After chat-first refactor                             |
| Collapsed/hidden chrome in chat   | ChatGPT sidebar, Claude | ✅ Sidebar collapse + no mobile bottom nav on Cat        |
| Single composer, bottom-fixed     | All                     | ✅ `.oc-chat-composer-wrap`                              |
| Narrow message column (~48rem)    | All                     | ✅ `.oc-chat-thread` max-w-3xl                           |
| No duplicate headers in chat      | All                     | ✅ Toolbar only; removed hub header                      |
| Model picker in header/composer   | ChatGPT, Grok           | ✅ Toolbar                                               |
| Thread list / history sidebar     | ChatGPT, Cursor         | ❌ Cat is ephemeral per spec; no thread list (by design) |
| Settings in separate screen       | All                     | ✅ `?tab=settings`                                       |
| Keyboard-first composer           | Cursor, ChatGPT         | ⚠️ Enter to send; no slash commands palette              |
| Streaming tokens                  | All                     | ✅ via `useChatMessages`                                 |
| No nested “dashboard” inside chat | All                     | ✅ Fixed                                                 |

**Cursor-specific:** Agent toolbar is minimal; heavy config lives in settings—not in the chat canvas. OrangeCat should keep **permissions/keys out of the default chat view** (current direction is correct).

---

## 5. DRY / SSOT violations (priority order)

### P0 — Fix soon

1. **Two model registries**
   - `config/ai-models.ts` — used by Cat `ModernChatPanel/ModelSelector`, auto-router, settings
   - `config/model-registry.ts` — used by `ai-chat/ModelSelector.tsx` for **public AI assistants** (`AIChatPanel`)
   - **Risk:** Different model lists, labels (“Auto (Best Free)” vs “Auto (Best for task)”), divergent IDs.
   - **Fix:** One registry (`ai-models.ts`); assistant UI imports shared `components/ai/ModelSelector` built on it; deprecate `model-registry.ts` or make it a thin view over `ai-models`.

2. **Two chat panels**
   - `ModernChatPanel` — Cat (canonical private agent)
   - `AIChatPanel` + `useAIChatPanel` — monetized assistants (`/ai-chat/...`)
   - **Acceptable SOC** if they share: `MessageBubble`, `ChatInput`, composer styles, markdown renderer, API client.
   - **Today:** Partial duplication (separate `AIChatMessage`, `AIChatInput`, `ModelSelector`).

3. **`CatAction` name collision**
   - `types/cat.ts` — UI suggested actions (`create_entity`, …)
   - `config/cat-actions.ts` — permission system actions (`create_product`, …)
   - **Fix:** Rename to `CatSuggestedAction` vs `CatPermissionAction` (or namespaces).

### P1 — Consolidate

4. **`ACTION_LABELS` in `MessageBubble.tsx`** duplicates labels from `cat-actions.ts` / `action-descriptions.ts`. Derive display labels from `CAT_ACTIONS[id].name` or executor results only.

5. **Layout height magic numbers** scattered (`100dvh-4rem`, `100dvh-3.5rem`, `15.5rem`). **Partially fixed** via `layout-chrome.ts`; messaging and `ai-chat` routes should adopt `APP_CONTENT_HEIGHT_CLASS`.

6. **Z-index:** `globals.css` uses `z-index: 9999 !important` for mobile menu; `constants/z-index.ts` defines `Z_INDEX` but tailwind `zIndex` in config duplicates another scale. Pick one SSOT.

### P2 — Hygiene

7. ~~**`ModernChatPanel.tsx` re-export shim**~~ — **DONE 2026-06-03** — shim deleted, importer in `dashboard/cat/page.tsx` updated to import from `ModernChatPanel/index`.

8. **Cat permissions** at `/dashboard/cat/permissions` vs `?tab=settings` — two entry points; ensure `ROUTES.DASHBOARD.CAT_PERMISSIONS` docs clarify.

9. **`data/aiProviders.ts`** — verify overlap with `ai-models.ts`.

---

## 6. What Cat components should _not_ do (SOC)

- **Do not** hardcode routes — use `ROUTES`, `CAT_HUB_TAB_HREFS`, `ENTITY_REGISTRY`
- **Do not** hardcode “Cat” / privacy strings — use `CAT_AGENT`, `CAT_HUB_COPY`
- **Do not** embed action business logic — `services/cat/action-executor.ts`
- **Do not** duplicate model metadata — `ai-models.ts` only
- **Do not** add hub tabs/status cards back into default chat — breaks chat-first UX

---

## 7. Recommended consolidation roadmap

**Recommended (do first):** Unify model registry + shared `ModelSelector` + export chat primitives from `components/ai-chat/primitives/` used by both Cat and assistants.

**Alternative A:** Keep two panels but enforce a `ChatShell` wrapper (toolbar slot, scroll region, composer slot) — less migration, still DRY layout.

**Alternative B:** Full rewrite to one `ChatPanel` with `mode: 'cat' | 'assistant'` — highest risk, only if assistants and Cat converge feature-wise.

---

## 8. Files touched in SSOT pass (2026-06-03)

- `src/config/layout-chrome.ts` — header/content height classes
- `src/config/cat-hub.ts` — agent copy, tab hrefs, composer placeholder
- `src/app/globals.css` — `.oc-chat-*` component classes
- Cat UI components updated to consume the above

---

## 9. Related docs

- `docs/my-cat-spec.md` — product behavior, privacy
- `docs/adr/ADR-0001-my-cat-conversational-entry.md` — architectural decision
- `docs/AUDIT_REPORT.md` — prior note on duplicate chat panels

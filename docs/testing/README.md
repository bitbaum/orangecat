# OrangeCat testing

created_date: 2025-01-01
last_modified_date: 2026-09-23
last_modified_summary: Wave-4 Cat cull — thinned tool-label / track-record / failed-turn / confirmed-chip / neighbour / answers / one-catalogue source-grep and prose pins; kept registry coverage and hard-ask routing.

## What we believe

**Signal beats headcount.** A thousand tests that restate implementation are slower and weaker than a hundred that pin user-visible contracts and static invariants.

The real gate is `pnpm run verify`: typecheck, lint, and the `check:*` scripts (dead fields/labels, routes, currency units, schema columns, RPC existence, locale, changelog, …) **then** unit tests. Those static checks catch whole classes of rot that unit tests usually miss.

## Layers

| Layer        | Tool                                  | What belongs here                                            |
| ------------ | ------------------------------------- | ------------------------------------------------------------ |
| Static gates | `scripts/check-*.mjs` inside `verify` | Drift, forbidden patterns, SSOT                              |
| Unit         | Vitest                                | Behaviour contracts, money paths, Cat tool/prompt invariants |
| E2E          | Playwright (`@p0` matrix)             | Thin, sacred journeys that must work on a real browser       |

Do **not** grow Playwright to match unit volume. Do **not** chase a coverage percentage.

## Cat tests (`__tests__/unit/cat/`)

Keep tests that fail when a **user-visible or money-moving** behaviour breaks, or when two sources of truth drift (registries, plan limits, provider lists, tool wiring).

Do **not** add:

- Byte snapshots of prompt prose (they train people to update goldens instead of thinking)
- Per-field exhaustiveness for every create handler (one table of forbidden/required columns is enough — see `action-executor-columns.test.ts`)
- Source-grep theatre that breaks when Prettier wraps a line (unless the assertion is about wiring _arguments_ or a TDZ order that typecheck cannot see, with whitespace collapsed)
- A second file that re-pins the same ladder/order/fit relationship already covered in `prompt-budget.test.ts`

## Commands

```bash
pnpm run test:unit          # what verify runs
pnpm exec vitest run __tests__/unit/cat   # Cat only
pnpm run test:e2e:matrix:p0 # sacred browser paths
pnpm run verify             # the real merge gate
```

## When you change Cat

1. Prefer extending an existing contract test over a new file.
2. If a create handler learns a new money column name, add one row to the column contract table — not a new describe block with three variants.
3. Run `pnpm exec vitest run __tests__/unit/cat` before push.

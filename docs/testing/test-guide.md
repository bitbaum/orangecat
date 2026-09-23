# OrangeCat testing guide

created_date: 2025-01-01
last_modified_date: 2026-09-23
last_modified_summary: Pointed at docs/testing/README.md as the policy SSOT; dropped coverage-percentage instructions.

**Policy SSOT:** [README.md](./README.md) — contracts over headcount, `verify` over coverage %.

## Commands

```bash
pnpm run verify                 # merge gate (static checks + unit)
pnpm run test:unit              # Vitest unit suite only
pnpm exec vitest run __tests__/unit/cat
pnpm run test:e2e:matrix:p0     # sacred Playwright paths
pnpm run test:e2e               # full Playwright (CI / release)
```

## Where tests live

| Path                  | Role                                         |
| --------------------- | -------------------------------------------- |
| `__tests__/unit/`     | Behaviour and SSOT contracts                 |
| `__tests__/unit/cat/` | Cat tool/prompt/money invariants — keep lean |
| `tests/e2e/`          | Playwright journeys; prefer `@p0`            |
| `scripts/check-*.mjs` | Static gates run by `verify`                 |

## Adding a test

1. Name the user-visible or money-moving contract it protects.
2. Prefer one row in an existing table-driven file over a new describe tree.
3. If `verify`'s `check:*` scripts already catch it, do not add a unit test.

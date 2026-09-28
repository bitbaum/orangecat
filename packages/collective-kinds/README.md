# @bitbaum/collective-kinds

The **single source of truth** for what kinds of collective exist across
OrangeCat, Loki and Solon — and two facts that travel with a collective
wherever it appears: **where** it is and **what it legally is**.

Three exports, nothing else:

| Module  | Answers                                                                                                                                 | Owned by     |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `kinds` | What kind of body is this? (circle, family, association, cooperative, collective, company, guild, DAO, town, network state, local fund) | this package |
| `place` | Where does it belong? (country → region → locality, and the one key rule for grouping)                                                  | this package |
| `legal` | What is it legally, with what evidence? (informal → registered → recognised tax-exempt)                                                 | this package |

What it deliberately does **not** contain:

- **How a body decides.** Solon owns its governance profiles and keeps its own
  `kind → default profile` table, keyed by these ids.
- **What a body may do with money.** OrangeCat owns its group features and
  keeps its own `kind → defaults` table, keyed by these ids.
- **OrangeCat's other entities.** A product, a loan or a service is not a
  collective; that registry is OrangeCat's alone.

Each product has a test that every kind here has a row in its own table, so a
kind added here cannot be half-supported there.

## Why

Until 2026-09-28 the same list lived three times — OrangeCat's group labels,
Solon's governance profiles, Solon's marketing audiences — eight, five and
five entries with no link, restated by hand in a Cat prompt, a handler comment,
a legacy alias map, two retyped unions and four message namespaces × five
languages. Copies drift; imports cannot. Same cure as
[`@bitbaum/design-tokens`](https://github.com/bitbaum/design-tokens).

## Install

Inside this repository it is a workspace package:

```jsonc
// package.json
"@bitbaum/collective-kinds": "workspace:*"
```

The package ships its TypeScript source (`exports` point at `src/index.ts`);
Next transpiles it via `transpilePackages`. From another repository, until it
has its own repository, pin it as a git dependency on this one:

```jsonc
"@bitbaum/collective-kinds": "github:bitbaum/orangecat#path:packages/collective-kinds"
```

```ts
import { COLLECTIVE_KINDS, placeKeys, mayClaimDeductibleGifts } from '@bitbaum/collective-kinds';
```

## Changing it

1. Edit `src/`. Adding a kind is one entry in `kinds.ts`.
2. `pnpm run verify` (format, lint, types, tests, fresh `dist/`).
3. `npm version minor && git push --follow-tags`.
4. Bump the dependency in OrangeCat, Loki and Solon. Their CI auto-merges.

The key rule in `place.ts` (`lower(btrim(x))`) is also written as SQL in
OrangeCat's `civic_splits` table; both sides pin it equal by test. Change one,
change both.

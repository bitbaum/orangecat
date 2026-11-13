# Cat and public search review — 2026-10-23

Production evidence showed a concrete inconsistency: `cqto` returned Cato from
`/api/search`, but `/api/v1/search?type=people` returned no matches, and a real
Cat request produced no matching profile link.

Cat, MCP, and the public API now use Discover's ranked public corpus and type
catalog. Optional semantic results are fused with lexical ranks rather than
replacing them. Vector records supply candidate identities only; a new SQL
lookup reads current public rows, excluding private, deleted and fixture records.
Exact titles and handles retain priority. Public lexical reads use the public
client. The private vector index uses server-only credentials because its RLS
blocks user clients; results still pass through the public-row lookup. Embedding
requests have a ten-second deadline and reject malformed or wrong-size vectors.

The command palette uses the existing TanStack Query package for cancellation,
explicit retry and account-keyed private suggestions. HTTP and malformed-envelope
failures remain visible rather than becoming an empty successful search. Cat's
instructions distinguish unavailable search from zero matches without increasing
the prompt budget.

Validation: focused ranking, hydration, catalog, query isolation and failure
recovery tests; real PostgreSQL 17 checks of the lookup's current visibility,
metadata, fixture filtering, identity matching, deduplication and candidate cap.
Phone, tablet and desktop Chromium checks passed: forced outage, keyboard Retry
on the unchanged query, real typo match, native profile navigation and no
horizontal overflow. The retry used the revised local API against real public
records. Full `pnpm run verify` passed in 1,136.8 seconds: 641 test files and 5,386 tests,
plus TypeScript, lint, route validation and all static guards. Deployed checks
remain pending.

Limits: live semantic provider readiness is not certified by these tests. The
public corpus has fourteen supported kinds and does not yet include articles.
This change does not claim complete coverage of every Cat action or app route.

The article writer uses platform provider credentials. Its unavailable response
now offers retry or the editor instead of claiming that adding a personal Groq
key repairs that separate provider path. A real production writing flow returned
HTTP 200 and filled the editor with a 616-word draft without publishing.

# OrangeCat as a Platform — and how it couples with Loki

**Status:** Architecture decision / north star. Not fully built — this is the
design both products converge toward.
**Scope:** OrangeCat (this repo) + Loki (separate repo,
`/home/g/dev/loki`). Cross-product; aligned by both agent tabs 2026-06-16.
**Companion spec:** `cross-product-identity-bridge.md` (Loki repo — the
"Login with OrangeCat" / OIDC keystone + the Loki relying-party side).

---

## The problem

OrangeCat and Loki are **both deeply collaborative, multi-tenant** products.
OrangeCat is identity + economy + communication + presence. Loki is the
AI agent-fleet that builds things. But **building is itself collaborative** — teams
talk, fund, divide roles, ship updates. So Loki appears to "need"
collaboration and communication too.

That creates an apparent contradiction:

- Put collaboration/comms in **both** apps → two diverging systems → **SSOT is dead**.
- Send Loki users **over to** OrangeCat to collaborate → constant
  context-switching → **UX is dead**.

They may merge someday, but **not now**. So we need tight coupling and mutual
empowerment _today_, under SoC / SSOT / DRY / config-driven discipline, without a
merge and without either failure above.

## The core move

> **Separate _where state lives_ (SSOT — one home) from _where it is rendered_
> (both UIs).**

State is single-homed; presentation is dual. Every decision below derives from this
one line. It dissolves the contradiction: collaboration state lives once (in the
platform), and is rendered natively wherever it's needed.

## The reframe: OrangeCat is two things

1. **OrangeCat the _platform_** — the headless backbone: identity, social graph,
   messaging, economy, publish/activity stream, collaboration primitives. API-first.
2. **OrangeCat the _app_** — one client of that platform (the public social/economy
   product).

**Loki is the second first-party client** of the same platform. Future
products — and eventually third parties via "Login with OrangeCat" — are further
clients.

So "Login with OrangeCat" is **not** an OC↔FC bridge; it is the **platform's front
door**. This is why the OIDC provider is the keystone: it's how any client adopts
the one identity + economy.

```
                 ┌───────────────────────────────────────────────┐
                 │            OrangeCat — the platform            │
                 │  actors · groups · follows · conversations ·   │
                 │  timeline_events (publish bus) · wallets ·     │
                 │  payment_intents · project_roles · OIDC        │
                 └───────────────▲───────────────▲───────────────┘
                                 │ API + OIDC     │ API + OIDC + async publish
                 ┌───────────────┴──────┐  ┌──────┴────────────────┐
                 │   OrangeCat the app   │  │      Loki       │
                 │ (presence + economy)  │  │ (build/execution +    │
                 │                       │  │  PRIVATE event spine)  │
                 └───────────────────────┘  └───────────────────────┘
        OC renders shared surfaces natively; Loki embeds them inline
```

## SSOT spine — one home per concern

Neither app forks these. Loki **references**, never re-implements.

| Concern             | Single source of truth                                   | Both apps         |
| ------------------- | -------------------------------------------------------- | ----------------- |
| Identity            | `actors` (OIDC `sub` = `actor_id`)                       | reference         |
| Team / org          | OC `groups` + `group_members` + `group_wallets` (target) | map at boundary\* |
| Social graph        | `follows`, `stakeholder_relationships`                   | read              |
| Messaging           | `conversations`                                          | embed inline      |
| Public activity     | `timeline_events` (the **publish** bus)                  | publish + read    |
| Economy             | `wallets`, `payment_intents`, `contributions`            | surface fund/pay  |
| Collaboration needs | `project_roles` (new) → existing `/jobs` surface         | surface board     |

Loki owns only its domain: agents, `orchestration_runs`,
`control_audit_events`, its **private** build-event spine, repos, the build cockpit.

\* Teams are **mapped, not migrated** yet — see below.

## Two streams, one publish bus (NOT a general event bus)

This is the correction that keeps SoC intact: `timeline_events` is the
**publish / activity bus**, not a firehose.

- **Loki keeps its own private build-event spine** (`events.jsonl`,
  `orchestration_runs`, `control_audit_events`) — high-volume, private. It renders
  its cockpit from its own data.
- A curated **"promote" step** lifts only publish-worthy events
  (`milestone.shipped`, `deployed`) into `timeline_events`. Which `event_type` is
  publish-worthy is a **config-driven policy**, not a hardcoded call site.
- **Each app reads its own stream; publish bridges between them.** The firehose
  never touches the public wall.

### Publishing is async + idempotent + reconcilable

Changelog → wall is **async / best-effort**, reusing Loki's existing
fire-and-forget pattern (`syncSubscriptionToOrangeCat`) — **never a synchronous
cross-app write.** That is what actually gives availability decoupling: Loki
renders from its own data regardless of OC's state.

But "best-effort" alone silently drops posts, so OC (which owns the receiving end)
makes the published event:

- **idempotent** — a `dedupe_key` on the `timeline_event` so a retry never
  double-posts;
- **reconcilable** — a periodic backfill (the same reconciler pattern OC already
  uses for embeddings) re-publishes anything missed while OC was down.

## "Building is collaborative" → map teams now, converge later

The _end state_ is that a build team is an **OrangeCat group** with a shared
multi-sig `group_wallet`. But **don't single-source teams into OC groups yet** —
Loki has its own `orgs` / `orgMemberships` wired into auth bootstrap
(`createPersonalOrg` in `events.signIn`), project sharing, and billing. That's an
auth-critical working subsystem; swapping it is merge-territory, deferred.

**For now — map at the boundary:**

- Loki keeps its orgs for internal build access.
- When a Loki project is team-funded / published, **associate** it with an OC
  `group` + `group_wallet` (funded on OC, spent by Loki via scoped OIDC
  tokens).
- The association requires Loki org members to **resolve to OC actors via the
  OIDC `sub`** — so even mapping is gated on the identity keystone.

Converge to one team model later, if/when the apps merge.

## DRY across UIs: embed OC surfaces, don't share a UI package

Rendering the same concern in two UIs is where duplication creeps back. The naive
fix — a shared `@oc/collab-ui` React package — is the **wrong** call here: the
stacks diverge (Loki = Next 16 / Tailwind v4 / Drizzle / a four-layer `ui-*`
design system; OrangeCat = Next 15 / Supabase). A shared component package means
ongoing build-pipeline coupling + version lock.

**Instead — embeddable OC widget routes.** OrangeCat exposes self-contained widget
routes (messaging panel, fund button, activity strip, collaborator board);
Loki mounts them inline via **iframe / web-component**, passing a **scoped
OIDC token over `postMessage`**. One implementation, **owned by OC, rendered
natively in Loki, zero build-pipeline coupling.**

Because OC _serves_ the embeds, OC owns their security:

- **origin-pinned `postMessage`** — only accept from / send to
  `loki.orangecat.ch`;
- **`frame-ancestors` CSP** on the embed routes — only trusted origins may frame
  them (anti-clickjacking);
- **short-lived scoped token** over `postMessage` — never the full session.

The set of embeddable surfaces is still **config-driven** (one registry entry per
surface → which route, scopes, and where it mounts), so adding a surface is one
config change. A shared npm package is reconsidered **only if embedding proves
insufficient** — unlikely for years.

## Keeping the UX good

In priority order:

1. **One account, two modes — never "two apps".** Single login (OIDC), one
   identity, shared design tokens. The user is in _Build_ mode or _Be/Trade_ mode,
   not on a different website.
2. **Embed at the right altitude; deep-link for depth.** Inline the lightweight
   widget (chat panel, fund button, activity strip) so the user never leaves;
   deep-link to the full surface for the rich experience. Progressive disclosure,
   across products.
3. **The Cat is the cross-product concierge.** One assistant spanning both worlds
   hides the seam entirely ("Milestone 2 shipped, 3 backers funded it, your
   collaborator is waiting on a reply"). This is the Cat-is-the-interface principle,
   and the single biggest UX unifier.
4. **Context always travels.** Cross-product links carry the project / conversation
   id so the user never loses their place.

## Honest costs (or it becomes worse than two apps)

- **Embed coupling, not code coupling** — embeddable widget routes keep the build
  pipelines independent, but OC owns the embed contract (postMessage protocol,
  CSP, token scopes). Version that contract deliberately.
- **Authz must be SSOT too** — one permission model (OIDC scopes + RLS on
  actor/project/group), expressed once. Never "Loki's idea of who can post"
  _and_ "OrangeCat's".
- **Availability coupling** — async + idempotent + reconcilable publishing is what
  makes the seam survive either app being down; never a synchronous cross-app write.
- **YAGNI the heavy stuff** — no shared UI package, no team migration, until the
  pain is real. Map and embed first.

## Sequencing

1. **OIDC provider** (the platform's front door) — identity SSOT. _Everything is
   gated on this._ (`.well-known/openid-configuration` + JWKS + `/oauth/authorize`
   reusing the Supabase session + `getOrCreateUserActor` + `/oauth/token` PKCE +
   `oauth_clients` / `oauth_auth_codes`, aligned to `integration_keys`' actor-bound
   model + revocation.) Then the **`resolveRequestAuth` JWT branch** so the
   access_token doubles as the v1 bearer.
2. **Async publish + read-only surfacing** — Loki promotes publish-worthy
   build events; OC ingests them idempotently onto the wall; status/changelog shown
   in both via deep-links + a status pill. No embeds yet.
3. **`project_roles` collaborator primitive** — the one genuinely missing thing;
   folds into the existing `/jobs` surface. (Parallel — doesn't touch Loki.)
4. **Home feed** — personalized reverse-chron feed of followed actors via the
   existing `get_user_timeline_feed` RPC. (Parallel — doesn't touch Loki.)
5. **Then, when the pain is real** — embeddable OC widget routes (messaging / fund /
   activity), mounted inline in Loki over postMessage.

**Building the seam this way _is_ the merge-later de-risk.** A real platform makes
"merging" just co-hosting two clients of one backbone. Growing two of everything
makes merging a migration. So we get tight coupling + mutual empowerment + clean
SoC now, and a free option to merge later — without committing to it.

## North star

> OrangeCat is the collaboration-and-economy **platform**; the OrangeCat app and
> Loki are two purpose-built **clients** of it; collaboration state is
> **single-sourced** and **embedded** everywhere it's needed; publishing between
> them is **async, idempotent, reconcilable**; and the **Cat** makes the seam
> invisible.

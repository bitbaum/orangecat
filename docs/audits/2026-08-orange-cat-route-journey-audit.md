# OrangeCat route and user-journey audit

Date: 2026-08-12  
Scope: every App Router page in `src/app`, compatibility URLs in `src/config/route-aliases.json`, desktop at 1440 px, and mobile at 375/390 px.

## Outcome standard

The source-derived catalogue contains **161 page patterns: 114 static and 47 dynamic**. A source file existing is not evidence that a user can use the page. `tests/e2e/responsive-route-inventory.spec.ts` classifies each attempted route as:

- `rendered`: the requested page rendered and passed the UI safety checks.
- `redirected`: it reached a different, intentional canonical page which passed the checks.
- `auth-redirect`: it reached the sign-in surface; this is an expected protected-route result, not a visual pass for the protected page.
- `fixture-required`: a dynamic page could not be exercised honestly without a real database/auth fixture. It is unresolved, never counted as passed.
- `failed`: HTTP status 400+, Next.js not-found UI, runtime/page error, horizontal overflow, missing `<main>`, or missing `<h1>`.

The report records requested pattern/path, source file, final status, final URL, redirect chain, console errors, page errors, exact redirect-contract result, link provenance/final semantics, and issue categories. JSON evidence and a full-page screenshot for **every resolved route** are written beneath `test-results/route-audit/<project>/`. Controls are inspected at scroll increments no larger than 80% of the viewport height, using the actual topmost element at each control center for occlusion. Axe injection or scan failure is a failure, never an empty result. The three release viewports are `chromium` (1440×1000), `mobile-375` (375×812), and `mobile-390` (390×844). The machine-readable contract embedded in each report is exported as `ROUTE_AUDIT_CONTRACT` from `tests/e2e/route-inventory.ts` and regression-tested.

## Page catalogue

### Static pages (114)

```text
/
/about
/ai-assistants
/articles
/articles/new
/assets
/assets/create
/auth
/auth/forgot-password
/auth/reset-password
/bitcoin-wallet-guide
/blog
/categories
/causes
/changelog
/channel
/circles
/collaborate
/coming-soon
/community
/company/about
/company/careers
/create
/dashboard
/dashboard/ai-assistants
/dashboard/ai-assistants/create
/dashboard/analytics
/dashboard/assets
/dashboard/assets/create
/dashboard/bookings
/dashboard/cat
/dashboard/cat/permissions
/dashboard/causes
/dashboard/causes/create
/dashboard/circles
/dashboard/circles/create
/dashboard/documents
/dashboard/documents/create
/dashboard/events
/dashboard/events/create
/dashboard/groups
/dashboard/groups/create
/dashboard/info
/dashboard/info/edit
/dashboard/investments
/dashboard/investments/create
/dashboard/loans
/dashboard/loans/create
/dashboard/people
/dashboard/projects
/dashboard/projects/create
/dashboard/research
/dashboard/research/create
/dashboard/services
/dashboard/services/create
/dashboard/store
/dashboard/store/create
/dashboard/tasks
/dashboard/tasks/analytics
/dashboard/tasks/new
/dashboard/wallets
/dashboard/wishlists
/dashboard/wishlists/create
/dashboard/wishlists/items/new
/discover
/docs
/documents
/donations
/events
/events/create
/faq
/groups
/groups/create
/home
/how-it-works
/investments
/jobs
/loans
/messages
/oauth/authorize
/oauth/error
/onboarding
/onboarding/intelligent
/pages
/pricing
/privacy
/products
/profile
/profile/setup
/profiles/me
/projects
/projects/create
/receive
/requests
/research
/roadmap
/security
/send
/services
/settings
/settings/ai
/settings/ai/onboarding
/settings/integrations
/settings/notifications
/settings/usage
/status
/study-bitcoin
/support
/technology
/terms
/timeline
/wallets
/whitepaper
/wishlists
```

### Dynamic pages (47)

```text
/[username]
/ai-assistants/[id]
/articles/[slug]
/articles/[slug]/edit
/assets/[id]
/blog/[slug]
/causes/[id]
/circles/[id]
/create/[entityType]
/dashboard/ai-assistants/[id]
/dashboard/assets/[id]
/dashboard/bookings/[id]
/dashboard/causes/[id]
/dashboard/causes/[id]/edit
/dashboard/circles/[id]
/dashboard/documents/[id]
/dashboard/events/[id]
/dashboard/groups/[slug]
/dashboard/investments/[id]
/dashboard/loans/[id]
/dashboard/research/[id]
/dashboard/services/[id]
/dashboard/store/[id]
/dashboard/tasks/[id]
/dashboard/tasks/[id]/edit
/dashboard/wishlists/[id]
/dashboard/wishlists/items/[itemId]
/documents/[id]
/events/[id]
/groups/[slug]
/groups/[slug]/events/[eventId]
/groups/[slug]/proposals
/groups/[slug]/proposals/[id]
/groups/[slug]/settings
/investments/[id]
/loans/[id]
/messages/[conversationId]
/pay/[username]
/post/[id]
/products/[id]
/profile/[username]
/profiles/[username]
/project/[id]
/projects/[id]
/research/[id]
/services/[id]
/wishlists/[id]
```

### Compatibility URLs

These do not own UI. Their only valid outcome is a permanent redirect to the canonical surface. The configuration-level aliases below live in `src/config/route-aliases.json`, shared by Next configuration and browser/API assertions.

| Compatibility family                                     | Canonical outcome                     |
| -------------------------------------------------------- | ------------------------------------- |
| `/login`, `/signin`, `/auth/login`, `/auth/signin`       | `/auth?mode=login`                    |
| `/register`, `/signup`, `/auth/register`, `/auth/signup` | `/auth?mode=register`                 |
| `/browse`, `/donate`                                     | `/discover`                           |
| `/fundraising`, `/fund-us`                               | `/how-it-works`                       |
| `/fund-us/:id`                                           | `/projects/:id`                       |
| `/fund-us/:id/edit`                                      | `/dashboard/projects/create?edit=:id` |
| `/cat`, `/chat`, `/ai`, `/ai-chat/:path*`                | `/dashboard/cat`                      |

Two App Router pages are redirect-only canonical-family adapters rather than configuration aliases:

| Redirect-only page    | Canonical renderer     |
| --------------------- | ---------------------- |
| `/profile/[username]` | `/profiles/[username]` |
| `/project/[id]`       | `/projects/[id]`       |

## Canonical route policy

- Public identity has one renderer: `/profiles/[username]`. `/<username>` and `/profile/[username]` are redirect-only aliases. IDs are never substituted for usernames because `/profiles/<id>` cannot resolve.
- Public projects have one renderer: `/projects/[id]`. `/project/[id]` is redirect-only.
- Public entity base paths are browse/discovery entry points. `/dashboard/<entity>` is the owner's management surface. For example, `/assets` leads to `/discover?type=assets`; `/dashboard/assets` manages the owner's assets.
- `/profiles/me` resolves to the signed-in user's username. A user without one is led to profile setup instead of a guaranteed 404.
- Personal feeds, money tools, onboarding, settings, messages, private documents, legacy create dispatchers, and owner dashboard routes are server-protected through `src/config/route-access.ts`. Community and collaboration listings remain useful to visitors; actions ask for sign-in at the moment it becomes necessary.

## User paths and intended outcomes

| User / intent                              | Primary path                                                                      | Valuable outcome                                                      | Guardrail                                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| First-time visitor evaluating OrangeCat    | `/` → `/how-it-works` → `/discover`                                               | Understand exchange/funding capabilities, then see real opportunities | Core proposition and CTA appear before long-form detail                       |
| Returning evaluator                        | remembered `/browse`, `/donate`, or `/fundraising`                                | Reach the current discovery/explanation surface                       | Permanent canonical redirects; no stale 404                                   |
| Explorer / supporter                       | `/discover` → type filter → public entity detail → fund/buy/book/contact          | Find a concrete person or offer and act                               | 15 mobile filters collapse to one labeled select; no multi-row control wall   |
| Donor / backer                             | `/discover?type=causes` or projects → detail payment section                      | Send Bitcoin to a real published receiver                             | Trust/owner block links only when a valid username exists                     |
| Buyer                                      | `/products` → `/products/[id]`                                                    | Evaluate and purchase a product                                       | Public list/detail are separate from owner store management                   |
| Service customer                           | `/services` → `/services/[id]`                                                    | Evaluate provider and request/book work                               | Provider identity and contact outcome remain close to the offer               |
| Event attendee                             | `/events` → `/events/[id]`                                                        | Find and join an event                                                | Public browse route, explicit detail fixture coverage                         |
| Fundraiser / project creator               | sign in → `/dashboard/projects/create` → `/dashboard/projects` → `/projects/[id]` | Publish, manage, and share a funding page                             | Owner/public routes are not conflated; legacy `/fund-us` redirects            |
| Seller / service provider / entity creator | `/create` → entity choice → dashboard create flow → public detail                 | Publish an offer without learning URL taxonomy                        | `/create/[entityType]` is one dispatch surface backed by entity registry      |
| Profile owner                              | sign in → `/profiles/me` → `/dashboard/info/edit`                                 | View/share a canonical identity or finish required username           | No user-ID fallback link                                                      |
| Profile visitor                            | `/profiles/[username]` → projects/articles/support                                | Establish trust, inspect work, support or connect                     | One canonical identity renderer; private login email remains redacted         |
| Network builder                            | `/dashboard/people` → follow/share/message                                        | Build a useful network                                                | Share is available only with a real public username                           |
| Community reader                           | `/community`                                                                      | Read public updates before registering                                | Anonymous community fetch is allowed; composer remains signed-in only         |
| Community contributor                      | `/community` → sign in → composer                                                 | Publish and interact                                                  | Write action stays auth-gated                                                 |
| Collaborator                               | `/collaborate` → role → “I’m interested”                                          | Browse roles, then open a conversation                                | Anonymous click leads to sign-in with return path                             |
| Project owner recruiting                   | sign in → `/collaborate` → post a role                                            | Recruit against an owned project                                      | Role form only appears when owned projects exist                              |
| Bitcoin novice                             | `/study-bitcoin` → `/bitcoin-wallet-guide` → `/wallets`                           | Learn, choose a wallet, then transact                                 | Education precedes operational tools                                          |
| Recipient                                  | sign in → `/receive` → `/pay/[username]` share link                               | Present a scannable/public payment destination                        | Receive is protected; payer page is intentionally public                      |
| Payer                                      | shared `/pay/[username]` or sign in → `/send`                                     | Pay without navigating the owner dashboard                            | Public pay route needs a valid profile fixture; send is protected             |
| Payment requester                          | sign in → `/requests`                                                             | Create and manage person-to-person requests                           | Middleware validates session before rendering personal data                   |
| Borrower / lender                          | `/loans` → `/loans/[id]` or dashboard create/manage                               | Evaluate or originate a loan                                          | Public detail and owner management have distinct URLs                         |
| Investor / opportunity owner               | `/investments` → `/investments/[id]` or dashboard create/manage                   | Evaluate or publish an investment                                     | Same public/owner separation                                                  |
| Group/community organizer                  | `/groups` → group detail → events/proposals/settings                              | Participate, govern, or administer                                    | Existing groups, proposals, and public events are discovered through read-only lists; absent rows stay explicit |
| Article reader                             | `/articles` or `/blog` → detail                                                   | Learn and assess expertise                                            | Bundled blog fixture gives deterministic public-detail coverage               |
| Author                                     | sign in → `/articles/new` → article → edit                                        | Draft, publish, and maintain writing                                  | Existing owned articles are discovered read-only; an account with none remains fixture-required for edit coverage |
| Cat AI user                                | `/cat` alias → sign in → `/dashboard/cat` → permissions/settings                  | Reach the flagship assistant and control access                       | All guessed aliases converge; protected surface never masquerades as rendered |
| Developer / integrator                     | `/docs`, `/oauth/authorize`, `/settings/integrations`                             | Understand APIs, authorize, and manage integrations                   | Public documentation is separate from account settings                        |
| Account/security user                      | `/auth` → onboarding → settings/security/notifications/usage                      | Establish and safely maintain an account                              | Auth return paths preserve intended destination                               |
| Operator checking platform trust           | `/status`, `/security`, `/privacy`, `/terms`, `/changelog`, `/roadmap`            | Verify reliability, policies, and direction                           | Direct public information routes with explicit headings/landmarks             |

## Information hierarchy and mobile decisions

1. Put the primary outcome first: discover, create, fund/pay, or contact. Supporting explanation follows it.
2. Keep public evaluation routes open; gate only personal data or the mutation at the moment of intent.
3. Avoid fake choices and dead affordances. An owner without a public username is plain content, not an anchor to `#` or an ID-shaped 404.
4. Keep browse and manage contexts distinct so back-navigation and page titles match the user's mental model.
5. On mobile, one full-width type selector replaces fifteen wrapped pills. Every entity remains reachable without consuming the first screen.
6. Use route builders/entity registry/alias JSON as SSOT. Browser inventory derives from files rather than a manually copied route list.

## Fixture contract and honest limitations

The audit intentionally does not invent database IDs. Before consulting environment fixtures it discovers existing records through request-context GET-only API reads and server-rendered links/sitemap entries. It does not render client pages during discovery, because client auth effects may call bootstrap-capable endpoints. Of the 47 dynamic patterns, 2 have bundled fixtures and the remaining 45 have a runtime/environment resolution branch; zero patterns are structurally unhandled. Actual unresolved count is data-dependent: profile, article, entity, group/proposal/event, conversation, task, booking, wishlist, and wishlist-item shapes resolve only when matching readable rows exist, while post detail stays environment-fixture-driven because the tempting Cat action-history GET expires pending actions as a side effect. Empty or permission-ineligible datasets stay `fixture-required`; the audit never creates production records to make itself pass. Bootstrap/mutating GETs (`/api/profile`, `/api/messages/self`, `/api/cat/nudges`, and `/api/cat/actions`) are explicitly excluded. The public group list and group Events list now use optional auth and limit anonymous callers to public records, so visitor journeys and fixtures can be resolved honestly.

Set these variables only for datasets that remain absent: `E2E_PROFILE_USERNAME`, `E2E_PROJECT_ID`, `E2E_POST_ID`, `E2E_ARTICLE_SLUG`, `E2E_CONVERSATION_ID`, `E2E_GROUP_SLUG`, `E2E_GROUP_PROPOSAL_FIXTURE` (`slug:id`), `E2E_GROUP_EVENT_FIXTURE` (`slug:eventId`), entity-specific `E2E_*_ID` values, and dashboard task/booking/wishlist-item IDs. Set `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` to exercise protected UI rather than its expected auth redirect. Local development also accepts the established `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` aliases from `.env.local`; values are never logged.

An anonymous audit is still exhaustive as a catalogue and access-boundary check, but it cannot honestly claim visual coverage of protected/dynamic interiors. Those remain explicitly visible in the JSON report until the fixture contract is supplied.

### Strict release gate

`npm run test:e2e:route-audit:strict` is the only command that can support a release-green claim. Strict mode requires a valid authenticated storage state whose `/dashboard/cat` page semantically proves the user session (user-menu trigger, Cat heading, no unresolved loading), zero `fixture-required` routes, zero route/UI/a11y failures, exact allowlisted canonical redirects, and zero runtime-emitted internal-link failures at all three viewports. A missing or stale authenticated state fails; it is not skipped.

The route audit is deliberately read-only. It inventories external `https:` links and `mailto:`, `tel:`, `bitcoin:`, and `lightning:` actions, but does not claim remote-destination uptime or launch OS wallet/mail/phone handlers. It also does not execute destructive or third-party mutations such as publishing, paying, sending messages, changing notification state, OAuth consent, or waitlist subscription. Those need isolated reversible fixtures and provider-specific tests; their presence in the link inventory is not a functional-pass claim. The persona tests exercise navigation, filtering, auth intent, forms up to safe validation boundaries, and read-only outcomes only.

## Verification commands

```bash
npm run audit:routes
npm run verify
npm run design:check
PLAYWRIGHT_CHANNEL=chrome E2E_BASE_URL=http://127.0.0.1:3020 npm run test:e2e:route-audit:strict
git diff --check
```

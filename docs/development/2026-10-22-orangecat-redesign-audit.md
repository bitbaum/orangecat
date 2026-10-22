# OrangeCat redesign audit — 2026-10-22

## Evidence and limits

The initial source inventory contains 194 page entrypoints. This is a source audit, not proof that every page works in production. The reported unresponsive plus tap still needs reproduction on the affected mobile browser. The supplied screenshots establish incorrect writing guidance, not the button failure's cause.

## First repair

The existing article composer supports Markdown, preview, local draft recovery, and AI controls. Article was absent from `buildCreateOptions`, which supplies the header, mobile sheet and create page. Restore it there rather than creating another editor. Replace the header's custom positioning and unconnected keyboard item refs with the existing portalled Radix menu primitive. Give Cat the actual writing routes, without requiring an economic entity.

## Redesign sequence

| Priority | Surface                                        | Work                                                                                                                                | Acceptance                                                                                                         |
| -------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| P0       | Create, articles, timeline                     | One creation catalog; explicit Article and Post choices; recoverable drafts; visible publish errors                                 | Header and mobile reach editor; keyboard and touch work; draft survives reload; publish reaches reader and feed    |
| P0       | Cat                                            | Ground links and actions in application capabilities; stop suggesting entities for writing; inspect chat overlays in shared chatkit | Article request links editor; no invented routes; composer and answers remain readable at 390px with keyboard open |
| P1       | Navigation and page shells                     | Align header, sidebar, bottom bar, sheet stacking and contextual actions                                                            | Every destination works signed in/out; back navigation preserves intent; menu remains within viewport              |
| P1       | Money                                          | Compare sibling receive/send/request frames before changing them; preserve currency and settlement contracts                        | Camera permission failure, invalid recipient and failed payment all offer recovery; no payment regression          |
| P1       | Entity lists and forms                         | Move repeated loading/error/empty states and form anatomy into existing shared components; retain registry-driven paths             | Each registry type can be created, edited and read with correct actor ownership                                    |
| P2       | Profiles, groups, discovery                    | Shared list rows, meaningful empty states, clear ownership and public/private boundaries                                            | Same data and visibility across profile, discovery and detail surfaces                                             |
| P2       | Settings, onboarding, utility and public pages | Remove stale claims and redundant wrappers; use semantic tokens and existing page frames                                            | Phone layout, auth redirects, error recovery and every primary action checked                                      |

Work in complete user journeys with small reviewable changes. Preserve existing storage and ownership contracts. Extract cross-product behavior into existing packages; do not add a second local chat implementation. A short route file can hide complexity in imported components, so line counts below are triage signals only.

## Release checks

Run the repository's `pnpm run verify` gate. For changed screens, inspect 390px and desktop, keyboard-only use, focus restoration, target size, loading/empty/error states and navigation. Writing additionally needs authenticated draft recovery and publish/read/feed checks against the configured backend. Mark each route as inspected only after these checks; the inventory below does not imply inspection.

## Page inventory

| Route pattern                          | Source entrypoint                                                      | Lines |
| -------------------------------------- | ---------------------------------------------------------------------- | ----: |
| `/assets/create`                       | `src/app/(authenticated)/assets/create/page.tsx`                       |    16 |
| `/assets`                              | `src/app/(authenticated)/assets/page.tsx`                              |    16 |
| `/collaborate`                         | `src/app/(authenticated)/collaborate/page.tsx`                         |   283 |
| `/community`                           | `src/app/(authenticated)/community/page.tsx`                           |    28 |
| `/dashboard/analytics`                 | `src/app/(authenticated)/dashboard/analytics/page.tsx`                 |   215 |
| `/dashboard/assets/[id]`               | `src/app/(authenticated)/dashboard/assets/[id]/page.tsx`               |    18 |
| `/dashboard/assets/create`             | `src/app/(authenticated)/dashboard/assets/create/page.tsx`             |     9 |
| `/dashboard/assets`                    | `src/app/(authenticated)/dashboard/assets/page.tsx`                    |    25 |
| `/dashboard/bookings/[id]`             | `src/app/(authenticated)/dashboard/bookings/[id]/page.tsx`             |   378 |
| `/dashboard/bookings`                  | `src/app/(authenticated)/dashboard/bookings/page.tsx`                  |   165 |
| `/dashboard/cat`                       | `src/app/(authenticated)/dashboard/cat/page.tsx`                       |   105 |
| `/dashboard/cat/permissions`           | `src/app/(authenticated)/dashboard/cat/permissions/page.tsx`           |    41 |
| `/dashboard/cat/settings`              | `src/app/(authenticated)/dashboard/cat/settings/page.tsx`              |   164 |
| `/dashboard/causes/[id]/edit`          | `src/app/(authenticated)/dashboard/causes/[id]/edit/page.tsx`          |    11 |
| `/dashboard/causes/[id]`               | `src/app/(authenticated)/dashboard/causes/[id]/page.tsx`               |    17 |
| `/dashboard/causes/create`             | `src/app/(authenticated)/dashboard/causes/create/page.tsx`             |     9 |
| `/dashboard/causes`                    | `src/app/(authenticated)/dashboard/causes/page.tsx`                    |    25 |
| `/dashboard/circles/[id]`              | `src/app/(authenticated)/dashboard/circles/[id]/page.tsx`              |    18 |
| `/dashboard/circles/create`            | `src/app/(authenticated)/dashboard/circles/create/page.tsx`            |     9 |
| `/dashboard/circles`                   | `src/app/(authenticated)/dashboard/circles/page.tsx`                   |    18 |
| `/dashboard/civic-split`               | `src/app/(authenticated)/dashboard/civic-split/page.tsx`               |    12 |
| `/dashboard/companions/[id]`           | `src/app/(authenticated)/dashboard/companions/[id]/page.tsx`           |    17 |
| `/dashboard/companions/create`         | `src/app/(authenticated)/dashboard/companions/create/page.tsx`         |    14 |
| `/dashboard/companions`                | `src/app/(authenticated)/dashboard/companions/page.tsx`                |    16 |
| `/dashboard/deals`                     | `src/app/(authenticated)/dashboard/deals/page.tsx`                     |    46 |
| `/dashboard/documents/[id]`            | `src/app/(authenticated)/dashboard/documents/[id]/page.tsx`            |   246 |
| `/dashboard/documents/create`          | `src/app/(authenticated)/dashboard/documents/create/page.tsx`          |   104 |
| `/dashboard/documents`                 | `src/app/(authenticated)/dashboard/documents/page.tsx`                 |    47 |
| `/dashboard/events/[id]`               | `src/app/(authenticated)/dashboard/events/[id]/page.tsx`               |    17 |
| `/dashboard/events/create`             | `src/app/(authenticated)/dashboard/events/create/page.tsx`             |     9 |
| `/dashboard/events`                    | `src/app/(authenticated)/dashboard/events/page.tsx`                    |    24 |
| `/dashboard/finances`                  | `src/app/(authenticated)/dashboard/finances/page.tsx`                  |    76 |
| `/dashboard/groups/[slug]`             | `src/app/(authenticated)/dashboard/groups/[slug]/page.tsx`             |    10 |
| `/dashboard/groups/create`             | `src/app/(authenticated)/dashboard/groups/create/page.tsx`             |     9 |
| `/dashboard/groups`                    | `src/app/(authenticated)/dashboard/groups/page.tsx`                    |    18 |
| `/dashboard/info/edit`                 | `src/app/(authenticated)/dashboard/info/edit/page.tsx`                 |    97 |
| `/dashboard/info`                      | `src/app/(authenticated)/dashboard/info/page.tsx`                      |    28 |
| `/dashboard/investments/[id]`          | `src/app/(authenticated)/dashboard/investments/[id]/page.tsx`          |    18 |
| `/dashboard/investments/create`        | `src/app/(authenticated)/dashboard/investments/create/page.tsx`        |    11 |
| `/dashboard/investments`               | `src/app/(authenticated)/dashboard/investments/page.tsx`               |    32 |
| `/dashboard/invitations/[id]`          | `src/app/(authenticated)/dashboard/invitations/[id]/page.tsx`          |    58 |
| `/dashboard/loans/[id]`                | `src/app/(authenticated)/dashboard/loans/[id]/page.tsx`                |    18 |
| `/dashboard/loans/create`              | `src/app/(authenticated)/dashboard/loans/create/page.tsx`              |     9 |
| `/dashboard/loans`                     | `src/app/(authenticated)/dashboard/loans/page.tsx`                     |   234 |
| `/dashboard`                           | `src/app/(authenticated)/dashboard/page.tsx`                           |   131 |
| `/dashboard/people`                    | `src/app/(authenticated)/dashboard/people/page.tsx`                    |   131 |
| `/dashboard/profile-claims/[id]/share` | `src/app/(authenticated)/dashboard/profile-claims/[id]/share/page.tsx` |    75 |
| `/dashboard/profile-claims/new`        | `src/app/(authenticated)/dashboard/profile-claims/new/page.tsx`        |   217 |
| `/dashboard/profile-claims`            | `src/app/(authenticated)/dashboard/profile-claims/page.tsx`            |   182 |
| `/dashboard/projects/create`           | `src/app/(authenticated)/dashboard/projects/create/page.tsx`           |     9 |
| `/dashboard/projects`                  | `src/app/(authenticated)/dashboard/projects/page.tsx`                  |    68 |
| `/dashboard/research/[id]`             | `src/app/(authenticated)/dashboard/research/[id]/page.tsx`             |    17 |
| `/dashboard/research/create`           | `src/app/(authenticated)/dashboard/research/create/page.tsx`           |    14 |
| `/dashboard/research`                  | `src/app/(authenticated)/dashboard/research/page.tsx`                  |   263 |
| `/dashboard/services/[id]`             | `src/app/(authenticated)/dashboard/services/[id]/page.tsx`             |    18 |
| `/dashboard/services/create`           | `src/app/(authenticated)/dashboard/services/create/page.tsx`           |     9 |
| `/dashboard/services`                  | `src/app/(authenticated)/dashboard/services/page.tsx`                  |    25 |
| `/dashboard/store/[id]`                | `src/app/(authenticated)/dashboard/store/[id]/page.tsx`                |    19 |
| `/dashboard/store/create`              | `src/app/(authenticated)/dashboard/store/create/page.tsx`              |     9 |
| `/dashboard/store`                     | `src/app/(authenticated)/dashboard/store/page.tsx`                     |    25 |
| `/dashboard/tasks/[id]/edit`           | `src/app/(authenticated)/dashboard/tasks/[id]/edit/page.tsx`           |    79 |
| `/dashboard/tasks/[id]`                | `src/app/(authenticated)/dashboard/tasks/[id]/page.tsx`                |   291 |
| `/dashboard/tasks/analytics`           | `src/app/(authenticated)/dashboard/tasks/analytics/page.tsx`           |   201 |
| `/dashboard/tasks/new`                 | `src/app/(authenticated)/dashboard/tasks/new/page.tsx`                 |    73 |
| `/dashboard/tasks`                     | `src/app/(authenticated)/dashboard/tasks/page.tsx`                     |   286 |
| `/dashboard/things`                    | `src/app/(authenticated)/dashboard/things/page.tsx`                    |    48 |
| `/dashboard/wallets`                   | `src/app/(authenticated)/dashboard/wallets/page.tsx`                   |   176 |
| `/dashboard/wishlists/[id]`            | `src/app/(authenticated)/dashboard/wishlists/[id]/page.tsx`            |    36 |
| `/dashboard/wishlists/create`          | `src/app/(authenticated)/dashboard/wishlists/create/page.tsx`          |     9 |
| `/dashboard/wishlists/items/[itemId]`  | `src/app/(authenticated)/dashboard/wishlists/items/[itemId]/page.tsx`  |   135 |
| `/dashboard/wishlists/items/new`       | `src/app/(authenticated)/dashboard/wishlists/items/new/page.tsx`       |   174 |
| `/dashboard/wishlists`                 | `src/app/(authenticated)/dashboard/wishlists/page.tsx`                 |    24 |
| `/home`                                | `src/app/(authenticated)/home/page.tsx`                                |    27 |
| `/messages/[conversationId]`           | `src/app/(authenticated)/messages/[conversationId]/page.tsx`           |    30 |
| `/messages`                            | `src/app/(authenticated)/messages/page.tsx`                            |    77 |
| `/post/[id]`                           | `src/app/(authenticated)/post/[id]/page.tsx`                           |   222 |
| `/profile/[username]`                  | `src/app/(authenticated)/profile/[username]/page.tsx`                  |    19 |
| `/profile`                             | `src/app/(authenticated)/profile/page.tsx`                             |    13 |
| `/project/[id]`                        | `src/app/(authenticated)/project/[id]/page.tsx`                        |    17 |
| `/projects/create`                     | `src/app/(authenticated)/projects/create/page.tsx`                     |    16 |
| `/receive`                             | `src/app/(authenticated)/receive/page.tsx`                             |    11 |
| `/requests`                            | `src/app/(authenticated)/requests/page.tsx`                            |    11 |
| `/send`                                | `src/app/(authenticated)/send/page.tsx`                                |    11 |
| `/settings/ai/onboarding`              | `src/app/(authenticated)/settings/ai/onboarding/page.tsx`              |    45 |
| `/settings/ai`                         | `src/app/(authenticated)/settings/ai/page.tsx`                         |    40 |
| `/settings/integrations`               | `src/app/(authenticated)/settings/integrations/page.tsx`               |   144 |
| `/settings/memory`                     | `src/app/(authenticated)/settings/memory/page.tsx`                     |    38 |
| `/settings/notifications`              | `src/app/(authenticated)/settings/notifications/page.tsx`              |   293 |
| `/settings`                            | `src/app/(authenticated)/settings/page.tsx`                            |   107 |
| `/settings/usage`                      | `src/app/(authenticated)/settings/usage/page.tsx`                      |   261 |
| `/share`                               | `src/app/(authenticated)/share/page.tsx`                               |    76 |
| `/timeline`                            | `src/app/(authenticated)/timeline/page.tsx`                            |   119 |
| `/about`                               | `src/app/(public)/about/page.tsx`                                      |   104 |
| `/articles/[slug]/edit`                | `src/app/(public)/articles/[slug]/edit/page.tsx`                       |    49 |
| `/articles/[slug]`                     | `src/app/(public)/articles/[slug]/page.tsx`                            |   244 |
| `/articles/new`                        | `src/app/(public)/articles/new/page.tsx`                               |    31 |
| `/articles`                            | `src/app/(public)/articles/page.tsx`                                   |    57 |
| `/bitcoin-wallet-guide`                | `src/app/(public)/bitcoin-wallet-guide/page.tsx`                       |   102 |
| `/blog/[slug]`                         | `src/app/(public)/blog/[slug]/page.tsx`                                |   219 |
| `/blog`                                | `src/app/(public)/blog/page.tsx`                                       |    60 |
| `/categories`                          | `src/app/(public)/categories/page.tsx`                                 |   100 |
| `/changelog`                           | `src/app/(public)/changelog/page.tsx`                                  |   118 |
| `/channel`                             | `src/app/(public)/channel/page.tsx`                                    |   208 |
| `/coming-soon`                         | `src/app/(public)/coming-soon/page.tsx`                                |     6 |
| `/company/about`                       | `src/app/(public)/company/about/page.tsx`                              |   255 |
| `/company/careers`                     | `src/app/(public)/company/careers/page.tsx`                            |   138 |
| `/docs/how-cat-runs`                   | `src/app/(public)/docs/how-cat-runs/page.tsx`                          |   194 |
| `/docs`                                | `src/app/(public)/docs/page.tsx`                                       |   332 |
| `/docs/sign-in-with-orangecat`         | `src/app/(public)/docs/sign-in-with-orangecat/page.tsx`                |   245 |
| `/domains`                             | `src/app/(public)/domains/page.tsx`                                    |   173 |
| `/donations`                           | `src/app/(public)/donations/page.tsx`                                  |     8 |
| `/ecosystem`                           | `src/app/(public)/ecosystem/page.tsx`                                  |   271 |
| `/faq`                                 | `src/app/(public)/faq/page.tsx`                                        |    73 |
| `/feedback`                            | `src/app/(public)/feedback/page.tsx`                                   |    17 |
| `/governance`                          | `src/app/(public)/governance/page.tsx`                                 |   153 |
| `/how-it-works`                        | `src/app/(public)/how-it-works/page.tsx`                               |   205 |
| `/pages`                               | `src/app/(public)/pages/page.tsx`                                      |     6 |
| `/partners`                            | `src/app/(public)/partners/page.tsx`                                   |    15 |
| `/pay/[username]`                      | `src/app/(public)/pay/[username]/page.tsx`                             |   103 |
| `/pay`                                 | `src/app/(public)/pay/page.tsx`                                        |    74 |
| `/pricing`                             | `src/app/(public)/pricing/page.tsx`                                    |   184 |
| `/privacy`                             | `src/app/(public)/privacy/page.tsx`                                    |    13 |
| `/raise`                               | `src/app/(public)/raise/page.tsx`                                      |    19 |
| `/roadmap`                             | `src/app/(public)/roadmap/page.tsx`                                    |    83 |
| `/security`                            | `src/app/(public)/security/page.tsx`                                   |   204 |
| `/status`                              | `src/app/(public)/status/page.tsx`                                     |   162 |
| `/steal`                               | `src/app/(public)/steal/page.tsx`                                      |   186 |
| `/study-bitcoin`                       | `src/app/(public)/study-bitcoin/page.tsx`                              |   151 |
| `/support`                             | `src/app/(public)/support/page.tsx`                                    |   195 |
| `/technology`                          | `src/app/(public)/technology/page.tsx`                                 |   250 |
| `/terms`                               | `src/app/(public)/terms/page.tsx`                                      |    13 |
| `/what-you-can-do`                     | `src/app/(public)/what-you-can-do/page.tsx`                            |    83 |
| `/whitepaper`                          | `src/app/(public)/whitepaper/page.tsx`                                 |    60 |
| `/[username]`                          | `src/app/[username]/page.tsx`                                          |    48 |
| `/assets/[id]`                         | `src/app/assets/[id]/page.tsx`                                         |    32 |
| `/auth/cant-get-email`                 | `src/app/auth/cant-get-email/page.tsx`                                 |   119 |
| `/auth`                                | `src/app/auth/page.tsx`                                                |    37 |
| `/auth/reset-password`                 | `src/app/auth/reset-password/page.tsx`                                 |   163 |
| `/causes/[id]`                         | `src/app/causes/[id]/page.tsx`                                         |    32 |
| `/causes`                              | `src/app/causes/page.tsx`                                              |     6 |
| `/circles/[id]`                        | `src/app/circles/[id]/page.tsx`                                        |    29 |
| `/circles`                             | `src/app/circles/page.tsx`                                             |     6 |
| `/claim/[token]`                       | `src/app/claim/[token]/page.tsx`                                       |    50 |
| `/companions/[id]/memory`              | `src/app/companions/[id]/memory/page.tsx`                              |    52 |
| `/companions/[id]`                     | `src/app/companions/[id]/page.tsx`                                     |    30 |
| `/companions/[id]/talk`                | `src/app/companions/[id]/talk/page.tsx`                                |    61 |
| `/companions`                          | `src/app/companions/page.tsx`                                          |     6 |
| `/create/[entityType]`                 | `src/app/create/[entityType]/page.tsx`                                 |    32 |
| `/create`                              | `src/app/create/page.tsx`                                              |    14 |
| `/discover`                            | `src/app/discover/page.tsx`                                            |    33 |
| `/documents/[id]`                      | `src/app/documents/[id]/page.tsx`                                      |    16 |
| `/documents`                           | `src/app/documents/page.tsx`                                           |    12 |
| `/events/[id]/door`                    | `src/app/events/[id]/door/page.tsx`                                    |   166 |
| `/events/[id]`                         | `src/app/events/[id]/page.tsx`                                         |    46 |
| `/events/[id]/ticket/[code]`           | `src/app/events/[id]/ticket/[code]/page.tsx`                           |   130 |
| `/events/create`                       | `src/app/events/create/page.tsx`                                       |    15 |
| `/events`                              | `src/app/events/page.tsx`                                              |   300 |
| `/groups/[slug]/events/[eventId]`      | `src/app/groups/[slug]/events/[eventId]/page.tsx`                      |   197 |
| `/groups/[slug]`                       | `src/app/groups/[slug]/page.tsx`                                       |   114 |
| `/groups/[slug]/proposals/[id]`        | `src/app/groups/[slug]/proposals/[id]/page.tsx`                        |    62 |
| `/groups/[slug]/proposals`             | `src/app/groups/[slug]/proposals/page.tsx`                             |    68 |
| `/groups/[slug]/settings`              | `src/app/groups/[slug]/settings/page.tsx`                              |   325 |
| `/groups/create`                       | `src/app/groups/create/page.tsx`                                       |    16 |
| `/groups`                              | `src/app/groups/page.tsx`                                              |     6 |
| `/investments/[id]`                    | `src/app/investments/[id]/page.tsx`                                    |    37 |
| `/investments`                         | `src/app/investments/page.tsx`                                         |     6 |
| `/jobs`                                | `src/app/jobs/page.tsx`                                                |   173 |
| `/loans/[id]`                          | `src/app/loans/[id]/page.tsx`                                          |    35 |
| `/loans`                               | `src/app/loans/page.tsx`                                               |     6 |
| `/oauth/authorize`                     | `src/app/oauth/authorize/page.tsx`                                     |   209 |
| `/oauth/error`                         | `src/app/oauth/error/page.tsx`                                         |    27 |
| `/onboarding/intelligent`              | `src/app/onboarding/intelligent/page.tsx`                              |     7 |
| `/onboarding`                          | `src/app/onboarding/page.tsx`                                          |    12 |
| `/`                                    | `src/app/page.tsx`                                                     |    57 |
| `/products/[id]`                       | `src/app/products/[id]/page.tsx`                                       |    32 |
| `/products`                            | `src/app/products/page.tsx`                                            |     6 |
| `/profile/setup`                       | `src/app/profile/setup/page.tsx`                                       |    27 |
| `/profiles/[username]`                 | `src/app/profiles/[username]/page.tsx`                                 |   415 |
| `/profiles/me`                         | `src/app/profiles/me/page.tsx`                                         |    30 |
| `/projects/[id]`                       | `src/app/projects/[id]/page.tsx`                                       |   300 |
| `/projects/[id]/room/deck`             | `src/app/projects/[id]/room/deck/page.tsx`                             |    56 |
| `/projects/[id]/room`                  | `src/app/projects/[id]/room/page.tsx`                                  |    51 |
| `/projects`                            | `src/app/projects/page.tsx`                                            |     6 |
| `/research/[id]`                       | `src/app/research/[id]/page.tsx`                                       |    29 |
| `/research`                            | `src/app/research/page.tsx`                                            |     6 |
| `/room/[token]/deck`                   | `src/app/room/[token]/deck/page.tsx`                                   |    60 |
| `/room/[token]`                        | `src/app/room/[token]/page.tsx`                                        |    75 |
| `/services/[id]`                       | `src/app/services/[id]/page.tsx`                                       |    32 |
| `/services`                            | `src/app/services/page.tsx`                                            |     6 |
| `/studio`                              | `src/app/studio/page.tsx`                                              |    10 |
| `/wallets/[id]`                        | `src/app/wallets/[id]/page.tsx`                                        |   153 |
| `/wallets`                             | `src/app/wallets/page.tsx`                                             |    50 |
| `/wishlists/[id]`                      | `src/app/wishlists/[id]/page.tsx`                                      |    58 |
| `/wishlists`                           | `src/app/wishlists/page.tsx`                                           |     6 |

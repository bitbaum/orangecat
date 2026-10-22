# OrangeCat browser review — 22 October 2026

## Evidence and method

All 17 supplied screenshots (1000026367.jpg through 1000026383.jpg) are review evidence. They cover Cat guidance, writing discovery, installed branding, the dashboard, activity feeds, the conversation list and the message view. They are not dismissed as browser-cache problems.

Chromium ran at 390 × 844 against the live application. The public Start instantly flow created a separate guest session; the owner’s account was not accessed. All 133 static routes received a first-viewport capture after navigation. This is a discovery pass, not a certification of interaction, complete loading, desktop design, or the underlying code. An initial reused-tab navigation race was corrected with fresh tabs and the affected routes were recaptured. Fast scanning triggered list rate limits; those pages need a normal-speed recheck.

The other 61 patterns comprise 59 dynamic routes and two stateful entrypoints (onboarding and password recovery). A real published article was opened from the article index and its back link exercised. Representative project, product and service details were read using links discovered in the application. Other record-dependent routes remain pending. No messages were sent, articles published, payments initiated, or existing account data removed.

## Reproduced issues

- A title changed just before leaving the article editor restored its older value. The 600 ms save timer was cancelled without flushing. The writing repair flushes on route unmount, pagehide and visibility change, preserves failed writes for retry, and avoids resurrecting published/discarded drafts.
- The writing screen placed a large AI panel and optional cover controls before the body. The repair leads with title/body, discloses optional assistance/metadata, uses shared controls, and exposes local-save status.
- On phones the article-index write link hid its entire text and had no explicit accessible name. The repair keeps a visible Write label.
- New Message is a custom overlay: no dialog semantics, Escape does not close it. The inbox Requests tab actually filters unread counts. Messaging repairs are next.
- Conversation rows are pointer-only; the search fields and several form controls rely on placeholders rather than associated labels. These need per-flow fixes using shared primitives.
- The global mobile Cat launcher overlaps inputs/feed content. The dashboard/timeline batch removes it on routes that already provide the Cat tab.
- A representative product describes a digital download but its stored type renders Physical. That is a data/contract inconsistency; do not silently infer or alter owners’ product data from description text.
- Article drafts currently share a device-wide storage namespace. Account-scoping needs a deliberate legacy-draft recovery path; silently moving or dropping existing drafts would be another data-loss bug.

## Route capture ledger

“Captured” only means a phone browser capture exists in this session. Dynamic coverage is representative, not all records.

| Route pattern                          | Evidence state                                                      |
| -------------------------------------- | ------------------------------------------------------------------- |
| `/assets/create`                       | Captured; interaction/source review pending                         |
| `/assets`                              | Captured; interaction/source review pending                         |
| `/collaborate`                         | Captured; interaction/source review pending                         |
| `/community`                           | Captured; interaction/source review pending                         |
| `/dashboard/analytics`                 | Captured; interaction/source review pending                         |
| `/dashboard/assets/[id]`               | Pending record or prerequisite state                                |
| `/dashboard/assets/create`             | Captured; interaction/source review pending                         |
| `/dashboard/assets`                    | Captured; interaction/source review pending                         |
| `/dashboard/bookings/[id]`             | Pending record or prerequisite state                                |
| `/dashboard/bookings`                  | Captured; interaction/source review pending                         |
| `/dashboard/cat`                       | Captured; interaction/source review pending                         |
| `/dashboard/cat/permissions`           | Captured; interaction/source review pending                         |
| `/dashboard/cat/settings`              | Captured; interaction/source review pending                         |
| `/dashboard/causes/[id]/edit`          | Pending record or prerequisite state                                |
| `/dashboard/causes/[id]`               | Pending record or prerequisite state                                |
| `/dashboard/causes/create`             | Captured; interaction/source review pending                         |
| `/dashboard/causes`                    | Captured; interaction/source review pending                         |
| `/dashboard/circles/[id]`              | Pending record or prerequisite state                                |
| `/dashboard/circles/create`            | Captured; interaction/source review pending                         |
| `/dashboard/circles`                   | Captured; interaction/source review pending                         |
| `/dashboard/civic-split`               | Captured; interaction/source review pending                         |
| `/dashboard/companions/[id]`           | Pending record or prerequisite state                                |
| `/dashboard/companions/create`         | Captured; interaction/source review pending                         |
| `/dashboard/companions`                | Captured; interaction/source review pending                         |
| `/dashboard/deals`                     | Captured; interaction/source review pending                         |
| `/dashboard/documents/[id]`            | Pending record or prerequisite state                                |
| `/dashboard/documents/create`          | Captured; interaction/source review pending                         |
| `/dashboard/documents`                 | Captured; interaction/source review pending                         |
| `/dashboard/events/[id]`               | Pending record or prerequisite state                                |
| `/dashboard/events/create`             | Captured; interaction/source review pending                         |
| `/dashboard/events`                    | Captured; interaction/source review pending                         |
| `/dashboard/finances`                  | Captured; interaction/source review pending                         |
| `/dashboard/groups/[slug]`             | Pending record or prerequisite state                                |
| `/dashboard/groups/create`             | Captured; interaction/source review pending                         |
| `/dashboard/groups`                    | Captured; interaction/source review pending                         |
| `/dashboard/info/edit`                 | Captured; interaction/source review pending                         |
| `/dashboard/info`                      | Captured; interaction/source review pending                         |
| `/dashboard/investments/[id]`          | Pending record or prerequisite state                                |
| `/dashboard/investments/create`        | Captured; interaction/source review pending                         |
| `/dashboard/investments`               | Captured; interaction/source review pending                         |
| `/dashboard/invitations/[id]`          | Pending record or prerequisite state                                |
| `/dashboard/loans/[id]`                | Pending record or prerequisite state                                |
| `/dashboard/loans/create`              | Captured; interaction/source review pending                         |
| `/dashboard/loans`                     | Captured; interaction/source review pending                         |
| `/dashboard`                           | Captured; interaction/source review pending                         |
| `/dashboard/people`                    | Captured; interaction/source review pending                         |
| `/dashboard/profile-claims/[id]/share` | Pending record or prerequisite state                                |
| `/dashboard/profile-claims/new`        | Captured; interaction/source review pending                         |
| `/dashboard/profile-claims`            | Captured; interaction/source review pending                         |
| `/dashboard/projects/create`           | Captured; interaction/source review pending                         |
| `/dashboard/projects`                  | Captured rate-limit recovery; normal-speed recheck pending          |
| `/dashboard/research/[id]`             | Pending record or prerequisite state                                |
| `/dashboard/research/create`           | Captured; interaction/source review pending                         |
| `/dashboard/research`                  | Captured; interaction/source review pending                         |
| `/dashboard/services/[id]`             | Pending record or prerequisite state                                |
| `/dashboard/services/create`           | Captured; interaction/source review pending                         |
| `/dashboard/services`                  | Captured rate-limit recovery; normal-speed recheck pending          |
| `/dashboard/store/[id]`                | Pending record or prerequisite state                                |
| `/dashboard/store/create`              | Captured; interaction/source review pending                         |
| `/dashboard/store`                     | Captured rate-limit recovery; normal-speed recheck pending          |
| `/dashboard/tasks/[id]/edit`           | Pending record or prerequisite state                                |
| `/dashboard/tasks/[id]`                | Pending record or prerequisite state                                |
| `/dashboard/tasks/analytics`           | Captured; interaction/source review pending                         |
| `/dashboard/tasks/new`                 | Captured; interaction/source review pending                         |
| `/dashboard/tasks`                     | Captured; interaction/source review pending                         |
| `/dashboard/things`                    | Captured; interaction/source review pending                         |
| `/dashboard/wallets`                   | Captured; interaction/source review pending                         |
| `/dashboard/wishlists/[id]`            | Pending record or prerequisite state                                |
| `/dashboard/wishlists/create`          | Captured; interaction/source review pending                         |
| `/dashboard/wishlists/items/[itemId]`  | Pending record or prerequisite state                                |
| `/dashboard/wishlists/items/new`       | Captured; interaction/source review pending                         |
| `/dashboard/wishlists`                 | Captured rate-limit recovery; normal-speed recheck pending          |
| `/home`                                | Captured; interaction/source review pending                         |
| `/messages/[conversationId]`           | Pending record or prerequisite state                                |
| `/messages`                            | Empty inbox and New Message/Escape exercised                        |
| `/post/[id]`                           | Pending record or prerequisite state                                |
| `/profile/[username]`                  | Pending record or prerequisite state                                |
| `/profile`                             | Captured; interaction/source review pending                         |
| `/project/[id]`                        | Pending record or prerequisite state                                |
| `/projects/create`                     | Captured; interaction/source review pending                         |
| `/receive`                             | Captured; interaction/source review pending                         |
| `/requests`                            | Captured; interaction/source review pending                         |
| `/send`                                | Captured; interaction/source review pending                         |
| `/settings/ai/onboarding`              | Captured; interaction/source review pending                         |
| `/settings/ai`                         | Captured; interaction/source review pending                         |
| `/settings/integrations`               | Captured; interaction/source review pending                         |
| `/settings/memory`                     | Captured; interaction/source review pending                         |
| `/settings/notifications`              | Captured; interaction/source review pending                         |
| `/settings`                            | Captured; interaction/source review pending                         |
| `/settings/usage`                      | Captured; interaction/source review pending                         |
| `/share`                               | Captured; interaction/source review pending                         |
| `/timeline`                            | Captured; interaction/source review pending                         |
| `/about`                               | Captured; interaction/source review pending                         |
| `/articles/[slug]/edit`                | Pending record or prerequisite state                                |
| `/articles/[slug]`                     | Representative real record opened; full flow pending                |
| `/articles/new`                        | Typing, preview, reload and immediate-navigation recovery exercised |
| `/articles`                            | Captured; interaction/source review pending                         |
| `/bitcoin-wallet-guide`                | Captured; interaction/source review pending                         |
| `/blog/[slug]`                         | Pending record or prerequisite state                                |
| `/blog`                                | Captured; interaction/source review pending                         |
| `/categories`                          | Captured; interaction/source review pending                         |
| `/changelog`                           | Captured; interaction/source review pending                         |
| `/channel`                             | Captured; interaction/source review pending                         |
| `/coming-soon`                         | Captured; interaction/source review pending                         |
| `/company/about`                       | Captured; interaction/source review pending                         |
| `/company/careers`                     | Captured; interaction/source review pending                         |
| `/docs/how-cat-runs`                   | Captured; interaction/source review pending                         |
| `/docs`                                | Captured; interaction/source review pending                         |
| `/docs/sign-in-with-orangecat`         | Captured; interaction/source review pending                         |
| `/domains`                             | Captured; interaction/source review pending                         |
| `/donations`                           | Captured; interaction/source review pending                         |
| `/ecosystem`                           | Captured; interaction/source review pending                         |
| `/faq`                                 | Captured; interaction/source review pending                         |
| `/feedback`                            | Captured; interaction/source review pending                         |
| `/governance`                          | Captured; interaction/source review pending                         |
| `/how-it-works`                        | Captured; interaction/source review pending                         |
| `/pages`                               | Captured; interaction/source review pending                         |
| `/partners`                            | Captured; interaction/source review pending                         |
| `/pay/[username]`                      | Pending record or prerequisite state                                |
| `/pay`                                 | Captured; interaction/source review pending                         |
| `/pricing`                             | Captured; interaction/source review pending                         |
| `/privacy`                             | Captured; interaction/source review pending                         |
| `/raise`                               | Captured; interaction/source review pending                         |
| `/roadmap`                             | Captured; interaction/source review pending                         |
| `/security`                            | Captured; interaction/source review pending                         |
| `/status`                              | Captured; interaction/source review pending                         |
| `/steal`                               | Captured; interaction/source review pending                         |
| `/study-bitcoin`                       | Captured; interaction/source review pending                         |
| `/support`                             | Captured; interaction/source review pending                         |
| `/technology`                          | Captured; interaction/source review pending                         |
| `/terms`                               | Captured; interaction/source review pending                         |
| `/what-you-can-do`                     | Captured; interaction/source review pending                         |
| `/whitepaper`                          | Captured; interaction/source review pending                         |
| `/[username]`                          | Pending record or prerequisite state                                |
| `/assets/[id]`                         | Pending record or prerequisite state                                |
| `/auth/cant-get-email`                 | Captured; interaction/source review pending                         |
| `/auth`                                | Public guest entry and destination preservation exercised           |
| `/auth/reset-password`                 | Pending record or prerequisite state                                |
| `/causes/[id]`                         | Pending record or prerequisite state                                |
| `/causes`                              | Captured; interaction/source review pending                         |
| `/circles/[id]`                        | Pending record or prerequisite state                                |
| `/circles`                             | Captured; interaction/source review pending                         |
| `/claim/[token]`                       | Pending record or prerequisite state                                |
| `/companions/[id]/memory`              | Pending record or prerequisite state                                |
| `/companions/[id]`                     | Pending record or prerequisite state                                |
| `/companions/[id]/talk`                | Pending record or prerequisite state                                |
| `/companions`                          | Captured; interaction/source review pending                         |
| `/create/[entityType]`                 | Pending record or prerequisite state                                |
| `/create`                              | Article choice exercised                                            |
| `/discover`                            | Captured; interaction/source review pending                         |
| `/documents/[id]`                      | Pending record or prerequisite state                                |
| `/documents`                           | Captured; interaction/source review pending                         |
| `/events/[id]/door`                    | Pending record or prerequisite state                                |
| `/events/[id]`                         | Pending record or prerequisite state                                |
| `/events/[id]/ticket/[code]`           | Pending record or prerequisite state                                |
| `/events/create`                       | Captured; interaction/source review pending                         |
| `/events`                              | Captured; interaction/source review pending                         |
| `/groups/[slug]/events/[eventId]`      | Pending record or prerequisite state                                |
| `/groups/[slug]`                       | Pending record or prerequisite state                                |
| `/groups/[slug]/proposals/[id]`        | Pending record or prerequisite state                                |
| `/groups/[slug]/proposals`             | Pending record or prerequisite state                                |
| `/groups/[slug]/settings`              | Pending record or prerequisite state                                |
| `/groups/create`                       | Captured; interaction/source review pending                         |
| `/groups`                              | Captured; interaction/source review pending                         |
| `/investments/[id]`                    | Pending record or prerequisite state                                |
| `/investments`                         | Captured; interaction/source review pending                         |
| `/jobs`                                | Captured; interaction/source review pending                         |
| `/loans/[id]`                          | Pending record or prerequisite state                                |
| `/loans`                               | Captured; interaction/source review pending                         |
| `/oauth/authorize`                     | Captured; interaction/source review pending                         |
| `/oauth/error`                         | Captured; interaction/source review pending                         |
| `/onboarding/intelligent`              | Captured; interaction/source review pending                         |
| `/onboarding`                          | Pending record or prerequisite state                                |
| `/`                                    | Captured; interaction/source review pending                         |
| `/products/[id]`                       | Representative real record opened; full flow pending                |
| `/products`                            | Captured; interaction/source review pending                         |
| `/profile/setup`                       | Captured; interaction/source review pending                         |
| `/profiles/[username]`                 | Pending record or prerequisite state                                |
| `/profiles/me`                         | Captured; interaction/source review pending                         |
| `/projects/[id]`                       | Representative real record opened; full flow pending                |
| `/projects/[id]/room/deck`             | Pending record or prerequisite state                                |
| `/projects/[id]/room`                  | Pending record or prerequisite state                                |
| `/projects`                            | Captured; interaction/source review pending                         |
| `/research/[id]`                       | Pending record or prerequisite state                                |
| `/research`                            | Captured; interaction/source review pending                         |
| `/room/[token]/deck`                   | Pending record or prerequisite state                                |
| `/room/[token]`                        | Pending record or prerequisite state                                |
| `/services/[id]`                       | Representative real record opened; full flow pending                |
| `/services`                            | Captured; interaction/source review pending                         |
| `/studio`                              | Captured; interaction/source review pending                         |
| `/wallets/[id]`                        | Pending record or prerequisite state                                |
| `/wallets`                             | Captured; interaction/source review pending                         |
| `/wishlists/[id]`                      | Pending record or prerequisite state                                |
| `/wishlists`                           | Captured; interaction/source review pending                         |

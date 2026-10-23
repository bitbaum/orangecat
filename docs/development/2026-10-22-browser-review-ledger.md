# OrangeCat browser review — 22 October 2026

## Evidence and method

All 17 supplied screenshots (1000026367.jpg through 1000026383.jpg) are review evidence. They cover Cat guidance, writing discovery, installed branding, the dashboard, activity feeds, the conversation list and the message view. They are not dismissed as browser-cache problems.

Chromium ran at 390 × 844 against the live application. The public Start instantly flow created a separate guest session; the owner’s account was not accessed. All 133 static routes received a first-viewport capture after navigation. This is a discovery pass, not a certification of interaction, complete loading, desktop design, or the underlying code. An initial reused-tab navigation race was corrected with fresh tabs and the affected routes were recaptured. Fast scanning triggered list rate limits; those pages need a normal-speed recheck.

The other 61 patterns comprise 59 dynamic routes and two stateful entrypoints (onboarding and password recovery). A real published article was opened from the article index and its back link exercised. Representative project, product and service details were read using links discovered in the application. Other record-dependent routes remain pending. No messages were sent, articles published, payments initiated, or existing account data removed.

## Reproduced issues

- A title changed just before leaving the article editor restored its older value. The 600 ms save timer was cancelled without flushing. The writing repair flushes on route unmount, pagehide and visibility change, preserves failed writes for retry, and avoids resurrecting published/discarded drafts.
- The writing screen placed a large AI panel and optional cover controls before the body. The repair leads with title/body, discloses optional assistance/metadata, uses shared controls, and exposes local-save status.
- On phones the article-index write link hid its entire text and had no explicit accessible name. The repair keeps a visible Write label.
- New Message used a custom overlay without dialog semantics or Escape. PR #1389 shipped the shared dialog, focus handling and truthful Unread filter; the live phone flow passed.
- The initial discovery pass flagged conversation-row keyboard access. Source review found an existing named native Open/Select action, so pointer-only is not a confirmed defect. Populated-list keyboard navigation still needs browser verification. Several form controls also need per-flow label review.
- The global mobile Cat launcher overlaps inputs/feed content. The dashboard/timeline batch removes it on routes that already provide the Cat tab.
- A representative product describes a digital download but its stored type renders Physical. That is a data/contract inconsistency; do not silently infer or alter owners’ product data from description text.
- Article drafts originally shared a device-wide storage namespace. The deployed account-scoped library now requires explicit recovery of older unowned drafts; switching and immediate navigation were verified with two own drafts.

## Verified follow-up flows

The live Create → Article → immediate Back → Article flow restored the newest local title. New Message focused its named search, closed with Escape and returned focus to New, without a redundant session-sync POST. A phone project wizard advanced by pointer, saved an own draft with profile visibility off, and deleted it through the card's owner confirmation.

After PR #1395 deployed, a new private article was readable by its author and returned 404 without its title to a signed-out reader. Owner editing preserved the URL. Deleting through owner controls was verified by a subsequent 404 for that owner. These new project/article fixtures were removed. The earlier private article from the first guest session remains private; that session's temporary credentials were lost during the workspace restart, so its cleanup is still outstanding.

The browser checks used a separate guest and its own records. They do not certify the remaining record-dependent routes or the owner's private data. The route table below retains its original discovery states; capture is still distinct from a completed interaction review.

## Follow-up verification — 23 October 2026

The deployed device-draft library retained two drafts across switching and immediate navigation. Cancelling discard restored its opener focus; deleting the last draft moved focus to New draft. Both test drafts were removed, and the 390px viewport had no horizontal overflow.

Deployed notification settings recovered from one injected GET failure through Retry. Category and digest controls stayed disabled during a held save; the separate test account's preference saved and was restored. Cat instructions had a visible accessible label and 16px phone text, with no horizontal overflow.

The Tasks review reproduced an ignored type filter (`type` emitted, `task_type` expected) and found the corresponding archive-key mismatch. The deployed phone flow passed named controls, both expected query keys, Clear filters resetting both choices, failed-load Retry and keyboard navigation to a task. No existing task was mutated.

The dashboard's package composer passed the full repository gate and a deployed 390px handoff twice. Both requests reached Cat exactly once, including a request containing an ampersand and a return after an earlier conversation; Home did not focus the field automatically. Cat's earlier article-location answer was “Not in your data”; the subsequent correct plain-text route still lacked an editor action. After the destination-link adapter deployed, the real production phone flow offered a native Article editor link and opened the editor without another chat POST. The one-off request left the test account's passive-memory count unchanged (zero).

The deployed Bookings flow recovered an injected failed load through Retry. History filtering did not hide Confirmed bookings; selected view semantics and 390px overflow checks passed. No booking was created or modified.

The short-post composer lost text on immediate close before its save timer. Its account/context-scoped repair passed a real phone preview for immediate close, cleared text, storage-failure retention, retry and explicit private recovery of older writing. Its full repository gate passed; PR #1417 is in CI and deployment remains pending.

A real touch gesture on the deployed project picker dismissed the sheet while swiping its body. A shared-sheet repair restricts dismissal to the handle and resets cancelled gestures; its real phone touch preview and full repository gate passed; deployment remains pending.

A controlled populated inbox passed keyboard entry into its thread, long-heading wrapping, composer clearance and no horizontal overflow. Every messaging write was intercepted; this does not certify delivery. Cancelling deletion lost focus after the transition; a shared-confirmation repair passed nine focused tests and the controlled phone preview, with its full gate still running.

The PWA metadata cleanup deployed. All four advertised versioned icons returned 200, and missing screenshots and dead protocol routes are no longer advertised. Android launcher and splash behavior remains unverified.

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

# Events, end to end — audit, plan, status

The question this answers: can someone run a real night on OrangeCat — "electronic
music night at Espresso Bar in Landquart on Friday" — from the first sentence to the
last guest through the door, and pay the people who made it happen?

Method: every gap below was **tested**, not assumed. The database was rebuilt from
all migrations on Supabase's own Postgres 15 image (the same image the box runs),
with PostgREST and GoTrue in front of it, and the app driven in Chromium at 390px
as four people: an organizer, a guest, a door person and a DJ. Each finding names
how it was found. The status column is kept current as items land.

## Found by testing (defects)

| # | Defect | How it was found | Status |
| --- | --- | --- | --- |
| 1 | A database built from the migrations creates accounts with **no profile**: the `auth.users` triggers live outside the dumped schema. | Sign-up on the replayed DB: account made, `profiles` empty. | Fixed — `20261007090000` creates them only where missing. |
| 2 | On a fresh database **every write to a search-indexed table fails** (`private.reindex_config` does not exist). | Same sign-up, after #1: "Database error creating new user". | Fixed — same migration creates the empty table. |
| 3 | **"Near me" can never work**: the site's `Permissions-Policy` sends `geolocation=()`, which denies the feature to its own origin. | Browser probe: "Geolocation has been disabled in this document by permissions policy". | Fixed — `geolocation=(self)`, pinned by a test. |
| 4 | **The Cat's `create_asset` always failed**: it set neither `owner_id` nor `type`, both required. | Reading the asset table while reworking venues. | Fixed. |
| 5 | **Event times are shown in the server's timezone**, and the Cat writes "Friday 22:00" as 22:00 UTC (its clock says UTC). A Landquart night at 22:00 showed as 8:00 PM. | Seeded a 22:00 Zurich event; the venue page read "8:00:00 PM". | Fixed — times are read and written in the venue's zone (`src/utils/timezone.ts`). |
| 6 | **Two models for "the place an event is at"**: main shipped place = asset (`events.asset_id`, "Happening here"); this branch had place = organization. | Merging main. | Fixed — one model (asset); anyone could list onto anyone's place before, now only whoever runs it. |
| 7 | The ticket migration would have **failed the migration-safety gate** CI runs on PRs. | Running `check-migration-safety.mjs` locally. | Fixed — the widened CHECK is acknowledged. |
| 9 | **Booking requests and deal-review reminders never reached anyone's notifications**: the database's list of notification types had drifted from the app's, so those inserts were rejected and only logged. | Inserting each dispatched type into the replayed DB. | Fixed — one list (`config/notification-types.ts`), the dispatcher's type checks it, a test keeps the database's copy equal. |
| 8 | "Near me" says "Location was not shared" for **every** geolocation failure, including ones the person cannot fix by sharing. | Same probe as #3. | Fixed — one sentence per kind of failure. |

## Product gaps (to build)

| Gap | Decision | Status |
| --- | --- | --- |
| Door staff cannot check people in — only the organizer's account. | A crew role can be **given to a person**; whoever holds the Door role can check people in. | Done — P2 |
| Crew roles have no person on them. | Roles hold people (up to the head-count), set by the organizer by @username; each is notified. | Done — P2 |
| Paying the crew. | **One click per person, by the organizer**, from the organizer's own connected wallet, recorded on the role. Not automatic: OrangeCat does not hold money, and an automatic payout would need it to. | Planned — P3 |
| Refunds. | The organizer cancels a paid ticket (seat freed, ticket marked refunded) and sends the money back with one click through the same rail. | Planned — P3 |
| Ticket reaches the guest only on the page. | A notification with the ticket link when a ticket is issued (paid or free). | Done — P2 |
| Cover pictures. | The Cat can set an event's cover from a photo sent in chat, or generate one when the person has an image-capable key; otherwise it says where to add one. | Planned — P4 |
| Venue in the manual form was a UUID text box. | A picker of the venues you run. | Done |
| Twint / bank / PayPal. | Platform-wide rails that need business accounts and are on the main roadmap; not built here, and nothing claims otherwise. | Not in this plan |
| The Cat against the live model. | Needs model keys this environment does not have; every handler is unit-tested and the tool schemas are generated from the registry. | Verified in production after merge |

## Plan, in order

- **P1 — correctness first.** ✅ Event times in the event's own timezone everywhere (page, lists, door, venue page, Cat); the Cat sends venue-local wall-clock times and the server converts them; a place's timezone comes from its coordinates. Geolocation errors say which kind they are.
- **P2 — the crew is real people.** ✅ Assign a person to a role; the Door role checks people in; tickets are announced by notification.
- **P3 — money out.** One-click crew payouts and refunds through the existing send rail, each leaving a record.
- **P4 — the cover.** From a chat photo or a generated image.
- **P5 — record it.** Changelog entries linked to the roadmap milestones they complete, and a write-up.

## How it was tested

- Migrations: all 101 replayed from zero on `supabase/postgres:15.8.1.060`, one transaction each (as `scripts/apply-migrations.sh`).
- Rules: ticket claims, seat race, forged tickets, check-in rights, venue listing rights (owner, organization member, pending steward, after a claim) — exercised as each role with `SET ROLE authenticated` and a real `auth.uid()`.
- UI: Chromium at 390×844, signed in through the real login form as each person; every page checked for sideways overflow, HTTP status and console errors, with a screenshot.

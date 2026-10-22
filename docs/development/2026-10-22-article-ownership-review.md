# Article ownership and writing workspace — 22 October 2026

## Reproduction and cause

The separate guest session saved an article with Only me selected. Saving succeeded, but the reader returned 404 to its author. The same author/profile mismatch also hid edit/delete controls and author lists.

`timeline_events.actor_id` is a legacy profile identifier: `timeline_events_actor_id_fkey` references `profiles(id)` in the schema migration, and its RLS policies compare the column with `auth.uid()`. The article writer already uses that profile ID. The reader, author list and edit page instead resolved a separate `actors.id` and compared different identity spaces. A misleading `authorActorId` type comment reinforced the mistake.

## Repair

The Article projection calls this field `authorProfileId`. Private reads and owner controls compare it with the authenticated user ID; the edit route uses the same contract. Author lists query the profile ID directly and verify the viewer before honoring an include-private option. This is a repair to the existing timeline contract, not a migration of economic entity ownership away from actors.

Followers-only articles require a confirmed follow relationship for a non-author reader. Missing sessions, private outsiders, failed relationship reads and unknown visibility values fail closed. View names use the existing database constants.

The editor was also classified as a public marketing route despite requiring authentication. New/edit paths now use the application shell, a collapsed desktop sidebar and focused phone chrome; the public article index and published reader retain public chrome. The writing surface's own assistance replaces a second floating Cat.

## Evidence and checks

Eight reader/list regression cases cover author access, private rejection, follower checks, failure behavior and the profile-ID query. Route tests distinguish public reading from authenticated writing.

A temporary integration probe used the actual guest session and backend, without the unit suite's mocked fetch/Supabase client. The repaired service read the previously inaccessible private article, identified the author, listed it for that author, and rejected a signed-out reader. The probe and its temporary configuration were removed before repository verification. No existing owner account was accessed or changed. The guest's private article remains for the deployed save/read/edit/delete verification and will be removed through its owner controls.

The broader route ledger still distinguishes captures from full source/interaction review. Pending writing work includes account-scoped local-draft recovery, preserving a failed local save when switching drafts, and edit-draft recovery. These are not certified by this repair.

# ADR-0014: A Person Holds More Than One Name

Date: 2026-11-11
Status: Accepted (D1–D6 shipped; D7–D10 on the roadmap)

## Context

Principle 2 says pseudonymous by default: any pseudonymous actor is a full
economic participant. One person, though, is more than one participant. The
same human sells under a studio name, writes under a pen name and funds things
they would rather not sign. Pessoa's word for this is the heteronym: not a
mask over one author but several authors, each with a voice, a history and a
reputation of their own.

The data model already allowed several actors per login, by accident: nothing
makes `actors.user_id` unique, and on 2026-09-18 one account held six. The code
treats that as a defect (`lookupUserActor` takes the oldest and warns).

The first design was to make it a feature: more `actor_type='user'` rows under
one login, with an "acting as" choice threaded through the request. Measured
against a replay of the schema and three code sweeps, it fails:

- `profiles.id` is the auth user id, and username, name, avatar and Lightning
  address live on that one row. `sync_profile_to_actor` overwrites every user
  actor with it on each profile update.
- 44 RLS policies resolve ownership through `actors.user_id = auth.uid()`, and
  eight entity tables carry a `NOT NULL user_id` that RLS checks. A second
  actor either cannot act, or stamps its holder's id on every row it creates,
  where anyone can read it.
- Conversations are keyed by login; timeline posts by the profile id; OAuth
  consent by `(user_id, client_id)`; profile claims by the profile. Each would
  show one identity under another's name.
- About 35 callers ask "which actor is this user" and get the oldest.

Every one of those is a place where a new axis fails silently, or leaks who is
behind a name.

## Decision

**An identity is a whole account. What makes it one of a person's identities is
one private row saying who holds it.**

**D1. Own account.** An identity has its own auth user, profile, actor, wallet,
timeline, inbox, consents and OIDC `sub`. Every existing feature works for it
unchanged, and Loki, Solon and Heidi see it as the separate person it is. The
Cat's account (`src/services/mentions/cat-account.ts`) is the precedent: an
account nobody signs into directly, on an address nobody can read.

**D2. The link is private by construction.** `identity_links(identity_user_id,
holder_user_id)` has RLS on and no policy: service role only, as
`profile_claims` is. Nothing an identity owns references its holder, so two
identities of one person cannot be joined from any public row. The application
answers "which identities are mine" from the holder's own session and for
nobody else.

**D3. The circle is the authority model.** The holder plus the identities it
holds. A session for any member may become a session for any other member and
for no one else. One level only: an identity holds nothing and a holder is not
an identity, enforced by trigger, so there is no chain to walk. The link is
written once. A product limit (`MAX_IDENTITIES`) sits in front of a higher
database ceiling.

**D4. Switching replaces the session.** `POST /api/identities/switch` checks the
circle on the service role, has GoTrue generate a one-time code for the target
(admin `generateLink`, which sends nothing) and exchanges it on the caller's
cookie-bound client. The same mechanism as sign-in by emailed code, minus the
email; the code never leaves the server. Cookie session only, so an OAuth token
issued to an app for one identity cannot become a session for another.

**D5. No way in except through the holder.** An identity is created on
`identity-<random>@orangecat.invalid` (RFC 2606: undeliverable) with no
password. The holder must have a real address before it can hold identities, so
the account that owns the rest can always be recovered. Apps are not told the
address: the `email` claim is absent for an unreachable address.

**D6. What ends together.** Sign-out everywhere ends the sessions and connected
apps of every member, because a session for one is a switch away from all.
Deleting the holder deletes its identities first and stops if one cannot be
removed. An identity can be deleted alone, never while signed in as it.

## Not yet (roadmap)

- **D7. One person, one vote in Solon.** Solon counts seats, and a seat is an
  account. A per-organization `person_tag = HMAC(secret, holder ‖ org)`,
  supplied by OrangeCat at admission and unique among human seats, lets Solon
  refuse a second seat for the same person without learning who anyone is or
  linking them across organizations. Goes where admission by MEMBERSHIP vote is
  built; that path does not exist in Solon yet.
- **D8. A switcher in the header**, and one unread count across the circle.
- **D9. Handing an identity over.** Giving it its own address and removing the
  link turns it into an ordinary account: ADR-0004's handing over the keys.
- **D10. Moderation.** A platform admin can resolve a circle; a ban reaches
  every member. No screen for it yet.

## Consequences

- Reputation starts cold for each identity. That is the point of a separate
  name, and it means a banned person can come back under a new one until D10.
- A person signed in as an identity is, to every query, only that identity.
  Seeing across the circle (D8) is an explicit service-role read.
- Switching to an account with a second factor yields a session at the first
  assurance level; anything that demands the second still asks for it.

## Verified, and not

Verified on a local replay of all migrations (Postgres 16): the link refuses a
self-link, a chain, a holder becoming an identity, a second holder for one
identity, any update, and a 25th identity; it is unreadable and unwritable to
`authenticated` and `anon`; it disappears with the identity's profile.

Not verified before merge: the two GoTrue calls in sequence against the live
auth server (`generateLink` then `verifyOtp` for an account on an `.invalid`
address), and `end_sessions_of` against the real `auth.sessions`. Both are
exercised by the unit tests only through fakes. The sign-out route reports
`identitiesSignedOut: false` and logs if the second fails.

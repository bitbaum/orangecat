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

**D6a. An identity with a way in of its own loses the circle.** An identity can
be given a password, a passkey or a real address from its own settings, and its
login can then be handed to someone else. That person must not be one request
away from the holder's main account. So an identity may use its circle only
while it is still the holder's alone: its address is still unreachable AND the
session came from a switch (`amr` is a one-time-code method, read from the
verified access token; `src/lib/auth/session-methods.ts`). Otherwise it stands
alone: it cannot switch, list, create, delete or sign the others out. The
holder is never gated. An allowlist, not a denylist: a sign-in method nobody
thought of fails closed.

**D6b. Which identity signs in to an app is chosen where it is asked.** The
consent screen (`/oauth/authorize`) lists the person's other identities under
"Or continue as"; choosing one switches and reloads the same authorize request
as that identity. Nothing is granted by the choice. The switch itself is
`switchSessionTo`, the one function the API route and this screen both call.
A trusted app with a remembered grant still skips the screen, as before, and
signs in whichever identity is current.

## Not yet (roadmap)

- **D7. One person, one vote in Solon.** Solon counts seats, and a seat is an
  account. A per-organization `person_tag = HMAC(secret, holder ‖ org)`,
  supplied by OrangeCat at admission and unique among human seats, lets Solon
  refuse a second seat for the same person without learning who anyone is or
  linking them across organizations. Goes where admission by MEMBERSHIP vote is
  built; that path does not exist in Solon yet.
- **D8. One unread count across the circle.** The switcher itself shipped,
  and lives in the fleet's shared menu: `AccountMenu` in `@bitbaum/accountkit`
  (0.28.0) lists a person's other accounts and switches on a tap. OrangeCat's
  header mounts it through `src/components/layout/AccountMenuControl.tsx`.
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

Verified on the live site after deploy (2026-11-11, three scripted walks with
throwaway accounts on `example.com`, deleted afterwards):

- Create, the handle refusals (taken, reserved), switch to the identity and
  back, and the same circle seen from both sides. So `generateLink` then
  `verifyOtp` works for an account on an `.invalid` address, and a switched
  session carries a sign-in method the D6a allowlist accepts.
- An identity cannot delete itself or the holder, and a switch to an account
  outside the circle answers 404.
- A signed-out visitor gets the identity's public page, and that page names
  neither the holder's id, handle nor email.
- Sign out everywhere pressed by the holder on one device ends the identity's
  session on another (`identitiesSignedOut: true`, then 401 there).
- Deleting an identity removes its page; deleting the holder removes its
  identities with it.
- D6a: an identity given a password, then entered with that password on
  another device, sees only itself, is not told who the holder is, and cannot
  switch into the holder (404), add identities (403) or delete the holder.

Not verified: which exact `amr` method GoTrue stamps on a switched session. It
is one of the three allowed; the walk could not decode the cookie to say which.

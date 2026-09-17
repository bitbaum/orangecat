# ADR-0004: Handing Over the Keys — Claims That Carry What a Person Owns

Date: 2026-09-05
Amended: 2026-09-07 — D8 and defects #10-#11, after asking what the _regular_
create flow (not Cat) would have to do. The answer changed the shape of the
work: the on-behalf-of control already exists and is already server-authorized.
Status: Proposed
Extends: [ADR-0003](ADR-0003-site-factory-and-unclaimed-entities.md)

## Context

The ask, in the words it arrived in: _a friend called Karl wants to open a bar.
I should be able to tell Cat, and it creates the bar and assigns it to Karl —
not to me. Karl isn't registered, so it has to create Karl too. It should be
visible that Karl exists and has no profile yet, and I should be able to send
Karl a link so he logs in and starts using it._

The strategic claim attached to it: this is how the platform grows — **hand the
keys to a profile to a person, instead of waiting for that person to register.**

### What already exists (measured 2026-09-05, against production)

Most of the person-half of this is **already built and has never been used.**

|                                    |                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `public.profile_claims`            | shipped 2026-08-18 (`supabase/migrations/20260818130000_profile_claims.sql`)                                 |
| Rows in production                 | **0**                                                                                                        |
| API                                | `POST/GET /api/profile-claims`, `GET/DELETE /api/profile-claims/[id]`, `POST /api/profile-claims/[id]/claim` |
| Creator UI                         | `/dashboard/profile-claims` (list, copy link, revoke) + `/dashboard/profile-claims/new`                      |
| Recipient UI                       | `/claim/[id]` → `src/components/claim/ClaimPageClient.tsx`, `noindex`, public preview                        |
| Links to it anywhere in navigation | **none**                                                                                                     |

The zero is explained by the last row. `src/config/navigation.ts` contains no
reference to `ROUTES.DASHBOARD.PROFILE_CLAIMS`; the only way to reach the
feature is to type the URL. It is not that members tried this and didn't want
it — **it has never been offered to anybody.**

### The constraint everything else bends around

```sql
-- 20260807010000_validate_profiles_id_fkey.sql
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_id_fkey;
```

`profiles.id` is a _validated_ FK to `auth.users(id)`. **A profile cannot exist
before its subject has an account.** This is deliberate, load-bearing, and it is
the structural half of ADR-0003's invariant — _money must never be routable to
an entity whose subject has not accepted it._ No `auth.users` row ⇒ no profile
⇒ no username ⇒ no wallet, and since a username **is** a Lightning address
(`<username>@orangecat.ch` via `.well-known/lnurlp`), no address to pay.

So "create Karl" cannot mean "insert a row into `profiles`". It means: hold
Karl's content somewhere until Karl arrives. That is exactly what
`profile_claims` is.

### What "a bar" is, structurally

There is no `organizations` table (`scripts/create-organization-tables.sql` was
never migrated). A bar is a **`groups` row with `label='company'`**
(`src/config/group-labels.ts`), which gets an `actors` row
(`actor_type='group'`), and whose owner is a `group_members` row with
`role='founder'` — and `group_members.user_id` FKs to `profiles(id)`.

Which closes the loop: a bar cannot have Karl as founder until Karl has a
profile, which he cannot have until he has an account.

## Problem

One sentence hides three problems, and only the first is solved:

1. **A person who is not a user must be representable.** — solved by `profile_claims`.
2. **The things they own must travel with them.** — not solved. `draft` is
   person-shaped (`{name, bio, avatarUrl, bannerUrl, website, socialLinks}`);
   there is nowhere to put a bar. ADR-0003 says this in as many words: _"It has
   no notion of a business, a group, or anything that can receive funds."_
3. **Someone must hand it over, and the recipient must be able to refuse.** —
   half-solved. There is a link, but no delivery, no read-receipt, no decline,
   and no way for the creator to know whether to nudge. `status` is
   `pending|claimed|revoked` — _revoked_ is the creator pulling the link, and
   there is no state for **Karl saying no**, which is the one state consent
   requires.

## Decision

### D1 — One primitive, extended. Not a second mechanism.

Generalise `profile_claims` into claims that carry a discriminated draft, per
ADR-0003. `draft` becomes:

```ts
type ClaimDraft = {
  kind: 'person';
  profile: { name; bio?; avatarUrl?; bannerUrl?; website?; socialLinks? };
  entities?: Array<
    | { kind: 'group'; label: GroupLabel; name; description?; tags?; location? }
    | { kind: 'project'; title; description?; goalAmount?; currency? }
  >;
};
```

This ADR is the **warm door** onto the primitive ADR-0003 specified for cold
prospecting: same table, same service-role posture, same money invariant. A
friend setting up a friend and the studio pitching a stranger differ in
_provenance_, not in structure — and provenance is a column, not an
architecture.

### D2 — Claiming materialises. Nothing ever transfers.

The steward never owns the bar, so there is no ownership to move. Before the
claim the rows do not exist; at claim they are **created already owned by the
claimer**.

No transfer step ⇒ no half-transferred state ⇒ no reconciliation job ⇒ no
second source of truth about who owns a fundable thing. This is what keeps
ADR-0003's invariant _structural_ rather than a rule someone has to remember.

### D3 — Materialisation is resumable, not transactional.

`claimProfileClaim` today compare-and-swaps `status → claimed`, writes the
profile, and on failure **best-effort rolls the claim back to pending**. With N
entities that is wrong: a rollback that deletes a group someone just watched
appear is worse than a retry. Add `materialized jsonb` recording what was
created; each step is idempotent (slug + suffix), and the claim page resumes
rather than unwinds.

What materialisation writes, for a person plus one company:

```
profiles     — fill only empty fields (D6); allocate username, reserved-checked
groups       — name, slug (slugify + randomSuffix), label='company', created_by = claimer
actors       — written by the trigger, not by the materialiser   ← see Defect #10
group_members— written by the trigger, role = 'founder'          ← see Defect #7
```

The last two lines used to be the materialiser's job. As of
`20260907100000_a_group_is_born_with_an_identity_and_an_owner.sql` they are an
`AFTER INSERT` trigger on `groups`, so the materialiser inserts the group and
both follow atomically. That removes them from the resume ledger entirely: they
cannot be half-written, so there is nothing to resume.

`role='founder'` is not a detail — both DELETE policies on `groups` require it,
and a group that gets any other role can be deleted by nobody. (An earlier draft
of this ADR attributed the three undeletable production groups to
`create_organization` writing `'admin'`. That was wrong; see the correction in
Defect #7.)

### D4 — Split the credential from the row id. Now, while it is free.

Today `profile_claims.id` **is** the claim token, deliberately (122 bits, no
extra column). The cost of that choice: the row can never be referenced in
public, because its public name is its password.

Every plausible next step needs a public reference that is not the credential —
a greyed `@karl` chip in the timeline for someone who hasn't joined, an
"unclaimed" placeholder page, an OG share card. Add `token uuid UNIQUE NOT NULL
DEFAULT gen_random_uuid()` and keep `id` internal.

**There are zero rows in production.** Today this is one migration. After the
first real claim it is a migration _plus_ rotating every link already sent to a
human being. This is the one-way door in the design; take it while it costs
nothing.

### D5 — Not public until claimed.

An unclaimed person and their bar are visible **at the claim link (noindex) and
in the creator's dashboard**. They are not in search, not in the timeline, not
at `/profiles/*`.

Three reasons, in order of weight: Karl has not consented; ADR-0003's _fabricate
no facts_ rule; and `camille-boulangerie/HANDOVER.md` §4 already found that a
public artifact carrying a real business's name that the business never
approved is undeliverable. The claim link is the distribution channel. It is
enough — it is a page, it just isn't an indexed one.

### D6 — One path, even when the recipient already has an account.

Cat must not branch on "is Karl already a user". The claim applies to whoever
claims it:

- profile fields **fill only what is empty** on the target profile;
- entities are **always** created;
- the claim page shows what will change before the button is pressed.

Today's code overwrites `name` and `bio` unconditionally — a friend who already
has a filled-in profile loses it on claim. That is a defect this work fixes,
not a design choice (see _Defects_).

### D7 — Delivery is link-first.

Default output is a **copyable link plus a prewritten message**. Email is one
extra click, never automatic, and only to an address the creator chose to send
to. People hand this over on WhatsApp; the product should lose to that
gracefully instead of pretending it owns the channel.

(There is also no invite email in the codebase to inherit: `group_invitations`
sends nothing, and the `invite_url` it returns —
`/groups/join/<token>` — **404s**, that route does not exist.)

### D8 — The create form is the primary door, and its control already exists.

D1-D7 were written Cat-first. That was the wrong emphasis. Cat is one input
method; the create form is where people already are, and **creating something
you do not own is already a shipped, server-authorized capability there.**

`src/components/create/ActorSelector.tsx` renders a dropdown whose own header
reads _"Create this on behalf of"_. The value flows: `EntityCreationWizard.tsx:108`
holds it in state -> `EntityForm` -> `entityFormSubmitAction.ts:87` merges
`actor_id` into the create body -> `entityPostHandler.ts:129` **extends the Zod
object** so the field is not stripped -> `resolveCreationActor()` re-reads the
actor with an admin client and requires founder/admin/moderator membership,
throwing `ActorNotPermittedError` -> 403. It never trusts the client. This is
good code, and it is the rail to build on.

It is invisible twice over, which is why it reads as missing:

- **It renders on 1 of 13 entity types.** `ActorSelector` appears in exactly one
  line of the codebase, inside the `config.wizardConfig?.enabled` branch of
  `EntityCreationWizard`. Of 16 entity configs, only `project-config.ts` sets
  `enabled: true`. The template-only and plain-form branches both drop the
  control while still passing `actorId` — permanently `null`, since nothing can
  set it. **Groups, the thing a bar actually is, are in that dead branch.**
- **It lists 3 of 9 production groups.** The dropdown is populated from `actors`
  rows, and nothing in the application ever inserts one for a group: no trigger,
  no backfill, no code path. `createGroup` writes `groups`, `group_members` and
  `group_features`, and no actor. Measured 2026-09-07: **9 groups, 3 group
  actors** — and the three are the three oldest, all from December 2025. Every
  group created since 2026-01-05 cannot own anything and cannot be selected.

So the work is not "build a way to create for someone else". It is **finish the
control that exists, then add one option to it.** Concretely:

1. **Lift `ActorSelector` out of the wizard branch** into the create header, so
   all 13 entity types show it. Zero server work — the API already accepts and
   authorizes `actor_id` on every route built on `createEntityPostHandler`.
2. **Backfill the missing group actors and create one in `createGroup`** (defect
   #10). Without this, "create as my company" is a control with an empty menu.
3. **Add a third option: _Someone else..._** — and note what it cannot be.

As shipped (#911), the option appears only for `group` and `project`: those are
the two kinds `ClaimDraft.entities[]` can carry, and offering it on an entity
type the claim cannot hold would walk a creator through the whole form and fail
at the end. Widening it means widening the draft union first, in that order.

**The third option is not an actor, and must not become one.** Karl has no
`auth.users` row, so he has no profile, so he can have no actor — and minting an
actor for him is precisely the alternative this ADR rejects below, because ~24
tables join `actors` and `actors.user_id` has no FK, which would demote the
money guarantee from structural to conventional. `resolveCreationActor` must
therefore **not** grow a person branch.

Instead the choice changes the **submit target**, not the owner:

```
Owner = me            -> POST /api/<entity>                     (today)
Owner = my group      -> POST /api/<entity> { actor_id }        (today, once lifted)
Owner = someone else  -> POST /api/profile-claims { draft: { kind:'person',
                           profile:{name}, entities:[<this form's values>] } }
```

The seam is one branch in `entityFormSubmitAction.ts`, which already computes
`url` and `requestBody` in adjacent statements. Nothing about the form, its
fields, its validation, its templates or its AI fill changes — the same
`validatedData` becomes a claim payload instead of an insert payload. That is
the whole point of routing this through the create form rather than a parallel
"invite" flow: **the form is the same form, so a bar drafted for Karl has
exactly the fields a bar has.**

**What must change in the UI, because the outcome differs:**

- **The control renders for everyone.** `ActorSelector` currently returns `null`
  when `groupActors.length === 0`, so a user with no groups sees nothing. Once
  "someone else" exists, that early return goes, and ownership becomes an
  explicit visible choice rather than an invisible default.
- **The submit button changes with the selection** — `Create project` becomes
  `Create & send to Karl`. A button that says "Create" and produces a link
  instead of a page is the single most likely thing to make a creator think it
  failed.
- **The success screen changes** (`EntityCreationSuccess.tsx`). Owner=me lands
  on the entity. Owner=someone-else has no entity to land on: it shows the link,
  the prewritten message, and the sentence that prevents the support ticket —
  _"Löwenbar isn't live yet. It appears when Karl accepts."_
- **Templates and AI fill stay untouched.** They operate on form values, and the
  form values are unchanged.

This also disposes of the objection that D1-D7 make this an AI feature. They do
not. A creator who never opens Cat gets the whole capability from the create
form; Cat's advantage is only that it skips the form.

## Schema

One migration:

```sql
ALTER TABLE public.profile_claims
  ADD COLUMN token uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),   -- D4
  ADD COLUMN materialized jsonb,                                     -- D3
  ADD COLUMN delivered_at timestamptz,                               -- funnel
  ADD COLUMN delivered_channel text,                                 --   "
  ADD COLUMN first_viewed_at timestamptz,                            --   "
  ADD COLUMN view_count integer NOT NULL DEFAULT 0,                  --   "
  ADD COLUMN declined_at timestamptz;                                -- consent

-- 'declined' is the recipient refusing; 'revoked' stays the creator withdrawing.
ALTER TABLE public.profile_claims DROP CONSTRAINT profile_claims_status_check;
ALTER TABLE public.profile_claims ADD CONSTRAINT profile_claims_status_check
  CHECK (status = ANY (ARRAY['pending','claimed','revoked','declined']));
```

`draft` needs no DDL — it is `jsonb`; the discriminator is enforced in Zod at
the boundary, which is where this repo enforces shapes. RLS stays as it is:
enabled, **zero policies**, service-role only. Do not add a permissive policy to
make anything simpler — the migration comment already explains why, citing
`group_invitations`' enumerable-token policy as the shape it refuses to repeat.

## The flow, end to end

### Creating it — George

Three doors, one server action underneath:

1. **Cat** (primary). _"my friend Karl is opening a bar in Zürich called
   Löwenbar"_ → a confirmation card.
2. **The create form** (the primary door — see D8). The existing
   _"Create this on behalf of"_ selector grows a third option, `Someone else`,
   which reveals name + optional contact. One control, not a parallel flow, and
   not new machinery: the selector, the `actor_id` wire and its server-side
   authorization all ship today.
3. **`/dashboard/profile-claims`**, finally linked in navigation — in the
   `coordinate` section of `src/config/navigation.ts`, beside **People**, as
   **"Set up for someone"**.

The confirmation card must state exactly three things, because these are the
three a creator gets wrong:

> **Karl** — a new person, no account yet
> **Löwenbar** — a company, owned by Karl
> Nothing is public until Karl accepts. Anyone with the link can take it over,
> so send it to Karl directly.

Then the output: the link, and a prewritten message next to it —

> _Hoi Karl — ich hab dir eine Seite für die Löwenbar gemacht. Gehört dir,
> einfach antippen: <link>_

— with one tap to WhatsApp / Signal / email / clipboard. The prewritten message
is not a nicety. It is the difference between a link George sends today and a
link George means to send this week.

### Waiting — the only status that matters

`Not sent → Sent → **Opened** → Claimed / Declined / Expired`

**Opened** is the single column that changes the creator's behaviour: it
separates "Karl hasn't seen it" from "Karl saw it and is thinking", and those
need opposite responses. Hence `first_viewed_at` / `view_count` in the
migration.

Nudges go **to George, in-app, once, after seven days** — never to Karl. The
platform does not chase people who have not joined it; the friend does. That is
both the correct consent posture and the more effective one.

### Receiving it — Karl

The claim page answers three questions in this order, on the first screen:
**What is this? Who sent it? What do I do?**

- **What**: not a form — a rendering of the profile _and the bar_ as they will
  look once live. The current page shows a bio card; it needs to show the
  thing he is being given.
- **Who**: a sender strip with George's real avatar, name, `@handle`, linked.
  Accountability and social proof are the same pixel.
- **What to do**: one primary button — **Take it over**. One quiet secondary —
  **Not me / remove this**.
- One reassurance line, because it is the first question a normal person asks:
  _Nothing is public yet. Only you and George can see this._

**Decline must work without signing in.** Requiring an account to say no is the
single worst thing this design could ship: it converts a consent valve into a
signup funnel. Declining sets `declined_at`, purges the draft content, and
notifies George.

Sign-in stays as it is (`?from=` already round-trips through
`/auth?mode=register`). After claiming, Karl lands **on the bar page, live**,
with a three-item checklist (photo, one line, publish) — not a blank dashboard,
not a wizard. Today's post-signup default is `/dashboard/cat?welcome=true`;
a claim must override it, because the whole promise was _here is your thing_.

### The loop

Only then, at the bottom of the page he just took ownership of:

> _Know someone else who should have one?_

Every claimer becomes a creator. This step is not a nice-to-have — **it is the
compounding mechanism.** Without it the feature is a nicer invite link; with it,
it is a growth loop.

## Cat

**One verb, not five.** `set_up_for_someone(name, what?, contact?)` in
`CAT_ACTIONS` (`src/config/cat-actions.ts`), category `entities`, risk
`medium`, `requiresConfirmation: true`, with a handler in
`src/services/cat/handlers/`. Listing, revoking and resending are dashboard
work and do not deserve prompt budget.

Four things the existing machinery gives us for free, and one it will take away
silently if we forget it:

**Confirmation is already real.** `requiresConfirmation` routes through
`CatActionExecutor` → `cat_pending_actions` (24h expiry) → `PendingActionsCard`,
with `generateActionDescription()` supplying the human sentence. We do not
design a confirm card; we write one good description string in
`src/services/cat/action-descriptions.ts`. That string is the whole UX of the
gate, so it carries the three facts from _Creating it_ above.

**Propose, don't create.** The prompt already prefers the `prefill_entity_form`
tool — a `PrefillProposal` rendered as a reviewable draft card that "never
auto-creates" — over the `create_*` actions. A handover is the strongest case
for that pattern in the product: George should see Karl and the bar as an
editable draft before anything is written about a third party. **Reuse
`PrefillProposal`; do not invent a second preview surface.**

**The catalog documents it for ~1 line.** `buildActionCatalogAppendix()`
auto-emits any enabled action not in `PROSE_DOCUMENTED_ACTION_IDS`. The budget
is hard and ratcheted — `PROMPT_BUDGET_CHARS = 54_600` in
`__tests__/unit/cat/prompt-budget.test.ts`, against a derived Groq ceiling of
39,808 that the prompt already overshoots. So: no prose section. Any prose
added must be paid for by compressing prose elsewhere.

**Fabricate nothing** (ADR-0003). Not the bar's address, not its hours, not a
bio for Karl. Only what George said. Empty fields are honest, and they are
precisely what gives Karl something to do on arrival.

**And the trap: it will be denied by default.** `DEFAULT_PERMISSIONS` in
`src/services/cat/permission-service.ts` grants only `context`; `entities`,
`communication`, `payments`, `organization` and `settings` are all `false` for
every new user. A new action in `entities` is therefore **denied for everybody**
unless it gets a per-action default the way `connect_wallet: true` does. Ship it
granted-with-confirmation — the confirm card is the real gate, and a verb nobody
can reach is the failure mode this whole ADR exists to correct.

Three drift gates will fail the build until the work is complete, which is the
right behaviour: `action-registry-drift.test.ts` (handler exists, key === id,
prompt mentions the id), `prompt-registry-agreement.test.ts` (advertised params
match the registry), `prompt-budget.test.ts` (budget + emittable form).

## Consent, abuse, and Swiss data protection

A claim is **personal data about an identifiable person, processed without their
consent**. Under revDSG (and GDPR for EU friends) the basis is legitimate
interest, and it holds only because of properties that must stay true:

| Property                                  | Mechanism                                          |
| ----------------------------------------- | -------------------------------------------------- |
| Minimal, creator-supplied data only       | no scraping on this door; Cat fabricates nothing   |
| Not public                                | D5 + `noindex` (already shipped)                   |
| Erasable in one click, without an account | the decline path (D7 / new `declined` state)       |
| Expires by itself                         | existing 180-day `expires_at`                      |
| Attributable                              | creator identity is shown to the recipient, always |

Plus, on the abuse side:

- a one-time attestation per creator — _I know this person and they are
  expecting this_;
- a **standing cap on pending claims per creator** (start at 10). The existing
  `rateLimitWriteAsync` limits request rate, not how many records about other
  people one account may hold open;
- notify the creator when a claim is consumed, so a link that reached the wrong
  person is visible immediately;
- no wallet, no Lightning address, no username before claim — structural today,
  and it must stay that way.

## Metrics

The funnel to publish: **created → sent → opened → claimed → activated**
(published something within 7 days).

Add to `scripts/check-data-invariants.mjs` (the nightly prod-truth gate):

- a claim `status='claimed'` with `materialized` null or incomplete — _a
  failure that looks like a success_, the exact class that made six real users
  read as engagement in [`cat-first`];
- a claimed claim whose entities were never created;
- a pending claim past `expires_at` never marked expired;
- **any profile whose username is in `RESERVED_USERNAMES`** (see Defects #3).

## Defects this work must fix (found while writing it)

1. **The feature is unreachable.** No navigation entry points at
   `/dashboard/profile-claims`. This is the whole explanation for 0 rows.
2. **Claiming overwrites the claimer's profile.** `claimProfileClaim` writes
   `name` and `bio` unconditionally onto the caller's row. A friend who already
   has an account loses their own name and bio. Fix: fill-only-empty + a diff
   preview (D6).
3. **The claim path bypasses reserved usernames.** `createClaimSchema` validates
   `suggestedUsername` with a bare regex instead of the shared username
   validator, and `findAvailableUsername` checks only for collisions — neither
   consults `RESERVED_USERNAMES` (`src/config/usernames.ts`), which
   `PUT /api/profile` does enforce. Measured in production: **14 of 15 reserved
   handles are free**, including `payments`, `billing`, `support`, `security`,
   `official`. A username is a Lightning address, so this mints
   `payments@orangecat.ch`. Fix before anything else here ships.
4. **Case-sensitivity mismatch.** `findAvailableUsername` probes with
   `.eq('username', candidate)` (case-sensitive) while uniqueness is enforced by
   `profiles_username_lower_key` on `lower(username)`. A candidate differing
   only in case passes the probe and then fails the insert — _after_ the CAS,
   landing in the rollback path.
5. **`group_invitations` is dead and leaky** (adjacent, not caused here): its
   `invite_url` points at `/groups/join/[token]`, which does not exist; no UI
   calls it; no email is ever sent; and its RLS policy
   `USING (token IS NOT NULL AND status = 'pending')` lets anyone enumerate
   every pending invitation token through PostgREST. Either delete it or fix
   it — do not build the second invite mechanism beside it.
6. **`notification_email_log` inserts omit two NOT NULL columns**
   (`email_address`, `subject`), so every delivery-log write fails silently
   inside a try/catch and email frequency caps never accumulate. Relevant
   because this feature adds a notification type.
7. **Three groups nobody can ever delete.** Both DELETE policies on `groups`
   require `get_user_group_role(...) = 'founder'`. Measured in production:
   **3 of 9 groups have no members at all** — "Bitcoin Education Foundation",
   "Network State Community", "Bitcoin Developers Circle" — so no user can
   delete them.

   **Corrected 2026-09-07.** This entry first blamed Cat's
   `create_organization` inserting `role: 'admin'`. That is wrong: production
   contains **zero** memberships with `role='admin'` — all six are `'founder'`.
   The real cause is `createGroup`
   (`src/services/groups/mutations/groups.ts`), which inserts the founder
   membership as a _second statement_ after the group row and treats failure as
   `logger.warn` while still returning `{ success: true }`. A failed insert
   therefore yields a group with a `created_by` and no members. The `'admin'`
   literal was real and is fixed in the same change, but it had never fired —
   the counts coinciding at 3 made an untested mechanism look confirmed.

   Fix (shipped): both the founder membership and the group's `actors` row move
   into an `AFTER INSERT` trigger on `groups`, so they are written in the same
   transaction as the group and no caller can forget or swallow them. Backfill
   included. See defect #10 — they are one fix.

8. **"Acting as a group" is a promise the executor does not keep.** The system
   prompt states _"Acting as: group X → any entity you propose to create belongs
   to that group"_ (`system-prompt.ts:151`), and the context renders that line —
   but the exec path resolves ownership through `getUserActorId()`
   (`chat-orchestrator.ts:265`), which is always the caller's **personal**
   actor. Named here because it is the same class as this ADR: OrangeCat already
   advertises create-on-behalf and silently creates on-self.
9. **Nothing caps `exec_action` blocks per reply.** `runExecActions`
   (`chat-orchestrator.ts:174`) loops over every parsed block even though the
   prompt says to emit one, and `response-parser.ts:118` validates only that
   `actionId` is a string and `parameters` is an object — no check against the
   registry's declared parameters. One reply could therefore mint several
   records about several third parties. The standing per-creator cap in
   _Consent_ is the backstop; this is the hole it backs up.
10. **Groups are created without an actor, so they can own nothing.** No
    trigger, backfill or code path inserts an `actors` row for a group;
    `createGroup` (`src/services/groups/mutations/groups.ts`) writes `groups`,
    `group_members` and `group_features` only. Measured 2026-09-07: **9 groups,
    3 group actors**, and all three date from December 2025 — every group made
    since 2026-01-05 is affected. Consequences: the group cannot be selected in
    _"Create this on behalf of"_, cannot own an entity, and cannot receive
    funds. Fix: create the actor inside `createGroup` in the same transaction,
    plus a backfill migration for the six. This is a prerequisite for D8, not a
    side quest.
11. **`/api/groups` is off the shared create rail.** It uses `withAuth` rather
    than `createEntityPostHandler`, so it never sees `actor_id` and never calls
    `resolveCreationActor`; `created_by` and the founder membership are
    hardcoded to the caller. Any on-behalf-of semantics for groups needs work
    there specifically — which matters because a bar _is_ a group.

## Implementation order

0. ~~**Defects #3, #4, #7 and #10, and one nav entry.**~~ **DONE.** Closed a
   handle-squatting hole, gave every group an owner and an identity, and turned
   a dead feature into a reachable one. (#3 and #4 shipped 2026-09-06, PR #903;
   #7, #10 and the nav entry 2026-09-07.)
1. ~~**The migration** (D3, D4, funnel columns, `declined`).~~ **DONE**, PR #908 —
   token split, `materialized`, funnel columns, the `declined` state, and D6's
   fill-only-empty. Verified applied in production.
2. ~~**Materialiser + resume + decline route** — the server half of D2/D3/D6.~~
   **DONE**, PRs #908 (decline) and #909 (D1 `entities[]`, materialiser,
   resume ledger). Group and project are the two entity kinds a claim can
   carry; anything else is refused at the boundary rather than silently
   dropped.
3. **The claim page rebuilt** — preview of the real thing, sender strip,
   decline-without-login, post-claim landing on the bar.
4. **Creator side (D8)** — ~~lift `ActorSelector` out of the wizard branch so
   all 13 entity types show it; add the `Someone else` option and the
   submit-target branch in `entityFormSubmitAction.ts`~~ **DONE**, PR #911.
   STILL OPEN: the prewritten message, the delivery channels, and the optional
   email send (pattern: `src/lib/email/send-seller-notification.ts`). The
   claim currently lands on the claims dashboard, which shows the link — the
   "one tap to WhatsApp" half of D7 is not built.
5. **Cat's verb**, inside the prompt ratchet.
6. **Invariants + funnel query.**

Steps 0 and 1 are independent. Step 5 is worth resisting until 3 exists — Cat
creating something whose landing page is still a bio card wastes the first
impression, and the first impression is the entire feature.

## Alternatives considered

**Rebind the actor: add `actor_type='claim'` and flip it to `'user'` on claim.**
Genuinely elegant — the bar would be a real row from t=0, owned by a stable
`actors.id` that never changes, so claiming attaches credentials to an identity
rather than materialising rows. Rejected for v1: it puts a person who has not
consented into `actors`, which ~24 entity tables and most RLS policies join
against, and `actors.user_id` has **no FK** — so "no money without an account"
would stop being structural and become a predicate every policy has to
remember. Revisit only if public placeholders (a greyed `@karl` mention) become
a requirement, and then with the money boundary re-proved by mutation.

**Shadow `auth.users` rows** (the anonymous-sign-in shape, which already creates
real users with no email). Rejected: it pollutes `auth.users` and every metric
derived from it, and it hands a never-consenting person a real, Lightning-
addressable username.

**Fix `group_invitations` and use it instead.** Rejected: it can only invite
someone _into a group that already exists_, which requires an owner — the
problem this ADR is about. See Defect #5 for its own state.

**Let the creator own the bar and transfer it on claim.** Rejected: it creates a
second, temporary source of truth about who owns a fundable entity, and a
transfer step that can half-fail. D2 exists precisely to not have this.

## Related

- [ADR-0003: The Site Factory, and Entities Nobody Has Claimed Yet](ADR-0003-site-factory-and-unclaimed-entities.md)
- [ADR-0001: My Cat Conversational Entry Layer](ADR-0001-my-cat-conversational-entry.md)
- `supabase/migrations/20260818130000_profile_claims.sql`
- `src/domain/profileClaims/service.ts`
- `camille-boulangerie/HANDOVER.md` §4

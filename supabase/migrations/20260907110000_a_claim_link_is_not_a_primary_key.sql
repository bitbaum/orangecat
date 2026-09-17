-- A claim link is not a primary key, and "no" is a state.
--
-- ADR-0004 D4 and the consent half of the problem statement.
--
-- 1. TOKEN. `profile_claims.id` currently doubles as the claim credential:
--    `/claim/<id>` is the link you send. That was a reasonable trade (122 bits,
--    no extra column), but it means the row can never be named in public,
--    because its public name is its password. Every plausible next step needs a
--    public reference that is not the credential — a greyed `@karl` chip for
--    someone who has not joined, an unclaimed placeholder page, a share card.
--
--    Splitting them is a ONE-WAY DOOR. Today `profile_claims` has zero
--    production rows, so this is one migration. After the first real claim it
--    is this migration plus rotating every link already sent to a human being.
--    That is the entire reason it is done now rather than when it is needed.
--
-- 2. DECLINED. `status` was pending|claimed|revoked. `revoked` is the CREATOR
--    withdrawing the link; there was no state for the RECIPIENT saying no —
--    the one state consent actually requires. Without it, "Karl doesn't want
--    this" and "Karl hasn't looked yet" are the same row, so the product
--    cannot stop nudging him, and cannot prove it was asked to stop.
--
-- 3. DELIVERY + MATERIALISATION. `delivered_at`/`delivered_channel`,
--    `first_viewed_at`/`view_count` make the funnel measurable (created → sent
--    → opened → claimed); `materialized` is the resume ledger for D3, recording
--    what a claim has already created so a partial claim resumes instead of
--    unwinding.

ALTER TABLE public.profile_claims
  ADD COLUMN token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN materialized jsonb,
  ADD COLUMN delivered_at timestamp with time zone,
  ADD COLUMN delivered_channel text,
  ADD COLUMN first_viewed_at timestamp with time zone,
  ADD COLUMN view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN declined_at timestamp with time zone;

-- The credential is unique and is what public routes look up by.
ALTER TABLE public.profile_claims
  ADD CONSTRAINT profile_claims_token_key UNIQUE (token);

-- migration-safety: contract-ok the dropped CHECK is immediately replaced by a
-- strictly WIDER one — old ⊂ new. The previous release only ever writes
-- 'pending', 'claimed' and 'revoked', all still permitted, so a code-only
-- auto-rollback keeps working against this schema. Nothing the old release
-- depends on is removed; the constraint is widened, never narrowed.
ALTER TABLE public.profile_claims
  DROP CONSTRAINT profile_claims_status_check;

ALTER TABLE public.profile_claims
  ADD CONSTRAINT profile_claims_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'claimed'::text, 'revoked'::text, 'declined'::text]));

-- A decline must record when, for the same reason a claim does: it is the
-- evidence that consent was refused, and refusing twice must not look like
-- never refusing.
ALTER TABLE public.profile_claims
  ADD CONSTRAINT profile_claims_declined_fields_check
  CHECK (
    (status = 'declined' AND declined_at IS NOT NULL)
    OR (status <> 'declined' AND declined_at IS NULL)
  );

COMMENT ON COLUMN public.profile_claims.token IS
  'The claim credential. /claim/<token> is the link that gets sent; `id` stays internal so a claim can be referenced publicly without handing over the ability to take it.';
COMMENT ON COLUMN public.profile_claims.materialized IS
  'Resume ledger (ADR-0004 D3): what this claim has already created, so a partially-applied claim resumes instead of rolling back rows a recipient has already seen.';
COMMENT ON COLUMN public.profile_claims.delivered_channel IS
  'How the creator sent it (link|whatsapp|email|...). Distinguishes "never sent" from "sent and ignored" — the two ends of the funnel that look identical without it.';
COMMENT ON COLUMN public.profile_claims.declined_at IS
  'The recipient refused. Distinct from `revoked`, which is the creator withdrawing the link.';

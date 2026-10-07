-- A project's own receiving address becomes a wallet linked to that project.
--
-- Projects carried bitcoin_address / lightning_address columns from before
-- wallets existed. The project page rendered them in a second payment box
-- ("Address verified and monitored", a QR, a pay button) beside the shared
-- payment section, which never reads those columns: it resolves
-- entity_wallets, then the owner's default wallet. So a project page could
-- show one address in one box and pay a different one from the other, and a
-- project whose owner had no wallet showed a pay button that could not pay.
--
-- Payment resolution already prefers a wallet linked to the entity. Giving
-- each legacy address that link makes the shared section pay exactly the
-- address the creator set for this project, and lets the second box go.
--
-- Scope, each rule a reason:
--   * only projects with no entity_wallets link — an explicit link is the
--     owner's newer choice and wins;
--   * only projects owned by a user actor with a profile — a group-owned
--     project pays the group's treasury, and a wallet needs a profile owner;
--   * never an unclaimed owner — the guard trigger refuses those, and a
--     placeholder cannot receive funds until claimed;
--   * an extended key becomes an xpub wallet (fresh address per payment),
--     never a plain address.
-- Each row is its own sub-transaction: one odd legacy row is skipped with a
-- notice instead of aborting the deploy. Re-running is a no-op (the link it
-- creates excludes the project the second time).
--
-- The link is 'private' (the column default): payments resolve through the
-- service role either way, and making a creator's address public is their
-- choice to make, not this migration's.

DO $$
DECLARE
  r record;
  v_address text;
  v_lightning text;
  v_type text;
  v_wallet uuid;
BEGIN
  FOR r IN
    SELECT p.id, p.title, p.bitcoin_address, p.lightning_address, a.user_id AS owner
      FROM public.projects p
      JOIN public.actors a ON a.id = p.actor_id
      JOIN public.profiles pr ON pr.id = a.user_id
     WHERE a.actor_type = 'user'
       AND p.group_id IS NULL
       AND (NULLIF(btrim(p.bitcoin_address), '') IS NOT NULL
            OR NULLIF(btrim(p.lightning_address), '') IS NOT NULL)
       AND NOT EXISTS (
         SELECT 1 FROM public.entity_wallets ew
          WHERE ew.entity_type = 'project' AND ew.entity_id = p.id
       )
  LOOP
    v_address := NULLIF(btrim(r.bitcoin_address), '');
    v_lightning := NULLIF(btrim(r.lightning_address), '');
    v_type := CASE
      WHEN v_address ~* '^[xyztuv]pub' THEN 'xpub'
      WHEN v_address IS NOT NULL AND v_lightning IS NOT NULL THEN 'both'
      WHEN v_address IS NOT NULL THEN 'address'
      ELSE 'lightning'
    END;

    BEGIN
      INSERT INTO public.wallets (profile_id, label, address_or_xpub, lightning_address, wallet_type)
      VALUES (
        r.owner,
        left('For ' || coalesce(NULLIF(btrim(r.title), ''), 'a project'), 100),
        v_address,
        v_lightning,
        v_type
      )
      RETURNING id INTO v_wallet;

      INSERT INTO public.entity_wallets (wallet_id, entity_type, entity_id, is_primary, created_by)
      VALUES (v_wallet, 'project', r.id, true, r.owner);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'legacy project address not linked (project %): %', r.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

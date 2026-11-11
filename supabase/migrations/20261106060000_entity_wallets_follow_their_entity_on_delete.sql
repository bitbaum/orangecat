-- A wallet link is deleted with the entity it points at, whatever deletes it.
--
-- entity_wallets is polymorphic (entity_type + entity_id), so no foreign key
-- can cascade it. Until now the cleanup lived in one place, the CRUD handler's
-- DELETE (src/lib/api/entityCrudHandler.ts), and every path that does not go
-- through it leaked. On 2026-11-06 the nightly data-invariant gate found three
-- links (one project, two AI assistants) whose entities had been deleted with no
-- audit row: they were removed outside the app, and a TypeScript cleanup cannot
-- see that. A trigger on each entity table can.
--
-- The table list mirrors ENTITY_TABLES in scripts/check-data-invariants.mjs,
-- which mirrors src/config/entity-registry.ts. A table that does not exist yet
-- is skipped, so a fresh replay cannot fail on ordering.
--
-- SECURITY DEFINER: the deleter's RLS scope may not cover the link row (the
-- handler uses the admin client for the same reason), and authorization to
-- delete the entity has already been decided by the time the row is gone.

CREATE OR REPLACE FUNCTION public.delete_entity_wallet_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.entity_wallets
  WHERE entity_type = TG_ARGV[0]
    AND entity_id = OLD.id;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_entity_wallet_links() FROM PUBLIC;

DO $$
DECLARE
  m record;
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      ('product', 'user_products'),
      ('service', 'user_services'),
      ('project', 'projects'),
      ('cause', 'user_causes'),
      ('event', 'events'),
      ('asset', 'assets'),
      ('loan', 'loans'),
      ('investment', 'investments'),
      ('ai_assistant', 'ai_assistants'),
      ('research', 'research_projects'),
      ('wishlist', 'wishlists'),
      ('document', 'documents'),
      ('group', 'groups'),
      ('circle', 'circles')
    ) AS t(entity_type, table_name)
  LOOP
    IF to_regclass('public.' || m.table_name) IS NULL THEN
      RAISE NOTICE 'entity_wallets cascade: public.% does not exist, skipped', m.table_name;
      CONTINUE;
    END IF;
    EXECUTE format(
      'DROP TRIGGER IF EXISTS entity_wallets_follow_delete ON public.%I',
      m.table_name
    );
    EXECUTE format(
      'CREATE TRIGGER entity_wallets_follow_delete AFTER DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.delete_entity_wallet_links(%L)',
      m.table_name, m.entity_type
    );

    -- Links already orphaned by earlier deletes go too, so the gate is green
    -- the moment this applies.
    IF to_regclass('public.entity_wallets') IS NOT NULL THEN
      EXECUTE format(
        'DELETE FROM public.entity_wallets w WHERE w.entity_type = %L '
        'AND NOT EXISTS (SELECT 1 FROM public.%I e WHERE e.id = w.entity_id)',
        m.entity_type, m.table_name
      );
    END IF;
  END LOOP;
END;
$$;

-- A deleted account takes its pages with it, and leaves other people their
-- records.
--
-- Settings → Delete Account calls POST /api/delete-user, which asks GoTrue to
-- delete the auth user. Replayed from zero on a scratch Postgres 16, that
-- DELETE could not succeed for anyone who owns a page or has traded:
--   * auth.users → profiles → actors cascades, and eight actor-owned tables
--     (projects, user_products, user_services, user_causes, loans, events,
--     research_entities, ai_assistants) answer the actor's delete with
--     ON DELETE SET NULL on an actor_id that is NOT NULL. Postgres refuses it
--     and the whole delete rolls back.
--   * orders.buyer_id / seller_id, loan_payments.payer_id / recipient_id,
--     event_payouts.created_by and the task tables' who-did-it columns point at
--     the person with NO ACTION, so one such row stops the delete outright.
-- So GoTrue's delete failed and the route answered "Failed to delete account.
-- Please try again." Every creator got that; an account that owned nothing and
-- had never traded deleted fine.
--
-- What Settings now says, and this makes true:
--   1. Every page the person owns goes. delete_account_pages() deletes each row
--      whose actor_id is the account's actor, walking the same catalog list
--      decline_placeholder_actor() walks (actor_owner_columns()), limited to the
--      owner column: a contributor_actor_id, customer_actor_id or to_actor_id
--      names the person on SOMEONE ELSE's row, and those keep their own FK rule.
--      /api/delete-user and /api/identities/[id] call it before GoTrue
--      deletes the user.
--   2. Orders and payments with other people stay in those people's records.
--      An order, a loan payment, an event payout or a task request is the other
--      party's record too, so the reference to the person who left becomes NULL
--      instead of blocking the delete or erasing someone else's history.
--
-- migration-safety: contract-ok each DROP NOT NULL only widens a column, and
-- each FK dropped is re-added in the same transaction on the same column and
-- target with ON DELETE SET NULL. Every row the previous release can write is
-- still valid, so a code-only rollback keeps working against this schema.

------------------------------------------------------------------------------
-- 1. Records other people keep: the person who left becomes NULL.
------------------------------------------------------------------------------

-- Found by catalog, not by name: whatever the constraint on (table, column) is
-- called on this database, it is replaced. A table that does not exist yet is
-- skipped, so a fresh replay cannot fail on ordering.
DO $$
DECLARE
  m record;
  c record;
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      ('orders',               'buyer_id',            'auth.users'),
      ('orders',               'seller_id',           'auth.users'),
      ('orders',               'shipping_address_id', 'public.shipping_addresses'),
      ('loan_payments',        'payer_id',            'public.profiles'),
      ('loan_payments',        'recipient_id',        'public.profiles'),
      ('event_payouts',        'created_by',          'auth.users'),
      ('task_projects',        'created_by',          'auth.users'),
      ('task_requests',        'requested_by',        'auth.users'),
      ('task_requests',        'responded_by',        'auth.users'),
      ('task_requests',        'requested_user_id',   'auth.users'),
      ('task_attention_flags', 'resolved_by',         'auth.users')
    ) AS t(table_name, column_name, target)
  LOOP
    IF to_regclass('public.' || m.table_name) IS NULL THEN
      RAISE NOTICE 'account deletion: public.% does not exist, skipped', m.table_name;
      CONTINUE;
    END IF;

    FOR c IN
      SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute a
          ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
       WHERE con.contype = 'f'
         AND con.conrelid = ('public.' || m.table_name)::regclass
         AND con.confrelid = m.target::regclass
         AND array_length(con.conkey, 1) = 1
         AND a.attname = m.column_name
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', m.table_name, c.conname);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL',
                   m.table_name, m.column_name);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s(id) ON DELETE SET NULL',
      m.table_name, m.table_name || '_' || m.column_name || '_fkey', m.column_name, m.target
    );
  END LOOP;
END $$;

------------------------------------------------------------------------------
-- 2. Every page the person owns goes with them.
------------------------------------------------------------------------------

-- Returns how many rows it deleted. Idempotent: a retry after GoTrue failed
-- finds nothing left and returns 0.
--
-- SECURITY DEFINER, service role only: the route has already authenticated the
-- caller and passes that caller's own id (and then each identity they hold).
-- The function takes only an account id, and touches only rows owned by that
-- account's actor.
CREATE OR REPLACE FUNCTION public.delete_account_pages(p_user uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  r record;
  v_rows integer;
  v_total integer := 0;
BEGIN
  FOR v_actor IN SELECT id FROM public.actors WHERE user_id = p_user LOOP
    FOR r IN SELECT * FROM public.actor_owner_columns() WHERE column_name = 'actor_id' LOOP
      EXECUTE format('DELETE FROM public.%I WHERE actor_id = $1', r.table_name)
        USING v_actor;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_total := v_total + v_rows;
    END LOOP;
  END LOOP;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_account_pages(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account_pages(uuid) TO service_role;

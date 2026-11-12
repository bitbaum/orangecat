-- A deleted account takes its own pages and data with it, and leaves other
-- people their records.
--
-- A deploy that queues behind a long transaction fails fast and is retried,
-- instead of holding every sign-in behind the locks on auth.users and profiles.
SET LOCAL lock_timeout = '5s';
--
-- Settings → Delete Account used to ask GoTrue to delete the auth user. Replayed
-- from zero on a scratch Postgres 16, that delete failed for anyone who owned a
-- page or had traded (eight page tables answer the actor's delete with
-- SET NULL on a NOT NULL actor_id; orders, loan payments, event payouts and the
-- task tables point at the person with NO ACTION). Once it could succeed, the
-- cascade reached past the person's own data: a buyer's deal, a backer's
-- support, a lender's offer and payment, a guest's ticket, a contributor's
-- wishlist or research contribution, a booking, a contract, and a whole
-- conversation with the other person's own messages in it. A loan, AI
-- assistant or research page a member created for a group went with the
-- member, and a founder who left stranded the group with nobody to run it.
--
-- What Settings now says, and this makes true:
--   1. The person's own pages go: every row whose actor_id is their actor. So do
--      their profile, posts (with the replies under them), messages they sent,
--      follows, wallets, addresses and settings.
--   2. Records another person keeps stay with that person. Each foreign key
--      that carried such a record off with the departing person or their page
--      now sets the reference NULL instead (section 1). A paid ticket stays as a
--      ticket for "Deleted account"; an unpaid registration goes.
--   3. Pages a member made for a group stay with the group (their user_id
--      becomes NULL; the group's actor still owns them).
--   4. A founder hands the group to the longest-standing remaining admin, or
--      member if there is no admin. A group the person was the last member of
--      has its pages unpublished (status draft, not public).
--   5. Someone with a paid or awaiting-payment order that ships to one of their
--      addresses cannot delete yet: the seller still needs the address. The
--      function refuses with account_has_unshipped_orders and deletes nothing.
--   6. All of it, for every identity the account holds and then the account,
--      happens in ONE transaction: delete_account() deletes the auth.users rows
--      itself, so a failure leaves everything as it was.
--
-- migration-safety: contract-ok each DROP NOT NULL only widens a column, and
-- each FK dropped is re-added in the same transaction on the same column and
-- target with ON DELETE SET NULL. Every row the previous release can write is
-- still valid, so a code-only rollback keeps working against this schema.
-- delete_account_pages() was only ever on this unmerged branch.

------------------------------------------------------------------------------
-- 1. Records other people keep: the reference to the person, or to the page
--    they owned, becomes NULL instead of taking the record with it.
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
      -- The departing person, on a record the other party shares.
      ('orders',                 'buyer_id',            'auth.users'),
      ('orders',                 'seller_id',           'auth.users'),
      ('orders',                 'shipping_address_id', 'public.shipping_addresses'),
      ('loan_payments',          'payer_id',            'public.profiles'),
      ('loan_payments',          'recipient_id',        'public.profiles'),
      ('loan_offers',            'offerer_id',          'public.profiles'),
      ('event_payouts',          'created_by',          'auth.users'),
      ('event_payouts',          'recipient_user_id',   'auth.users'),
      ('event_attendees',        'user_id',             'auth.users'),
      ('bookings',               'customer_user_id',    'auth.users'),
      ('bookings',               'customer_actor_id',   'public.actors'),
      ('bookings',               'provider_actor_id',   'public.actors'),
      ('deals',                  'customer_actor_id',   'public.actors'),
      ('deals',                  'provider_actor_id',   'public.actors'),
      ('contracts',              'party_a_actor_id',    'public.actors'),
      ('contracts',              'party_b_actor_id',    'public.actors'),
      ('payment_requests',       'requester_id',        'public.profiles'),
      ('payment_requests',       'payer_id',            'public.profiles'),
      ('conversations',          'created_by',          'public.profiles'),
      ('task_projects',          'created_by',          'auth.users'),
      ('task_requests',          'requested_by',        'auth.users'),
      ('task_requests',          'responded_by',        'auth.users'),
      ('task_requests',          'requested_user_id',   'auth.users'),
      ('task_attention_flags',   'resolved_by',         'auth.users'),
      -- What a member did inside a group stays with the group.
      ('group_events',           'creator_id',          'auth.users'),
      ('group_proposals',        'proposer_id',         'public.profiles'),
      ('group_votes',            'voter_id',            'auth.users'),
      ('loans',                  'user_id',             'public.profiles'),
      ('ai_assistants',          'user_id',             'public.profiles'),
      ('research_entities',      'user_id',             'public.profiles'),
      -- Another person's money or offer on a page the departing person owned.
      ('loan_offers',            'loan_id',             'public.loans'),
      ('loan_payments',          'loan_id',             'public.loans'),
      ('project_support',        'project_id',          'public.projects'),
      ('event_attendees',        'event_id',            'public.events'),
      ('event_payouts',          'event_id',            'public.events'),
      ('research_contributions', 'research_entity_id',  'public.research_entities'),
      ('wishlist_contributions', 'wishlist_item_id',    'public.wishlist_items')
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
-- 2. One transaction deletes the account.
------------------------------------------------------------------------------

-- The function deletes auth.users rows itself, as its owner. Fail the deploy
-- here, not the first person who tries to leave, if the owner cannot.
DO $$
BEGIN
  IF NOT has_table_privilege(current_user, 'auth.users', 'DELETE') THEN
    RAISE EXCEPTION 'account deletion: % cannot DELETE FROM auth.users', current_user;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.delete_account_pages(uuid);

-- SECURITY DEFINER, service role only: /api/delete-user and
-- /api/identities/[id] have already authenticated the caller and decided which
-- account may go. The function takes that one id, and also deletes every
-- identity that account holds (identity_links.holder_user_id), identities first.
-- An id that no longer exists deletes nothing and returns accounts = 0.
CREATE OR REPLACE FUNCTION public.delete_account(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_accounts uuid[];
  v_account uuid;
  v_actor uuid;
  v_group record;
  v_next record;
  v_table record;
  v_set text;
  v_rows integer;
  v_pages integer := 0;
  v_handed integer := 0;
  v_unpublished integer := 0;
BEGIN
  SELECT coalesce(array_agg(u.id ORDER BY u.id = p_user, u.id), '{}')
    INTO v_accounts
    FROM auth.users u
   WHERE u.id = p_user
      OR u.id IN (SELECT l.identity_user_id FROM public.identity_links l
                   WHERE l.holder_user_id = p_user);

  IF cardinality(v_accounts) = 0 THEN
    RETURN jsonb_build_object('accounts', 0, 'pages', 0,
                              'groups_handed_over', 0, 'groups_unpublished', 0);
  END IF;

  -- A seller is still owed an address for an order not yet shipped.
  IF EXISTS (
    SELECT 1 FROM public.orders o
      JOIN public.shipping_addresses s ON s.id = o.shipping_address_id
     WHERE s.user_id = ANY (v_accounts)
       AND o.status IN ('pending_payment', 'paid')
  ) THEN
    RAISE EXCEPTION 'account_has_unshipped_orders'
      USING HINT = 'An order shipping to this account''s address has not shipped yet.';
  END IF;

  -- Groups: a founder hands over; a group with nobody left is unpublished.
  FOR v_group IN
    SELECT DISTINCT gm.group_id, a.id AS group_actor
      FROM public.group_members gm
      LEFT JOIN public.actors a ON a.group_id = gm.group_id
     WHERE gm.user_id = ANY (v_accounts)
  LOOP
    SELECT gm.id, gm.user_id INTO v_next
      FROM public.group_members gm
     WHERE gm.group_id = v_group.group_id
       AND gm.user_id <> ALL (v_accounts)
     ORDER BY CASE gm.role WHEN 'founder' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
              gm.joined_at NULLS LAST, gm.id
     LIMIT 1;

    IF NOT FOUND THEN
      IF v_group.group_actor IS NOT NULL THEN
        FOR v_table IN
          SELECT oc.table_name FROM public.actor_owner_columns() oc WHERE oc.column_name = 'actor_id'
        LOOP
          SELECT string_agg(format('%I = %s', c.column_name,
                                   CASE c.column_name WHEN 'status' THEN quote_literal('draft') ELSE 'false' END), ', ')
            INTO v_set
            FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = v_table.table_name
             AND c.column_name IN ('status', 'is_public', 'is_active');
          IF v_set IS NOT NULL THEN
            EXECUTE format('UPDATE public.%I SET %s WHERE actor_id = $1', v_table.table_name, v_set)
              USING v_group.group_actor;
          END IF;
        END LOOP;
      END IF;
      v_unpublished := v_unpublished + 1;
    ELSIF EXISTS (SELECT 1 FROM public.group_members gm
                   WHERE gm.group_id = v_group.group_id AND gm.role = 'founder'
                     AND gm.user_id = ANY (v_accounts))
      AND NOT EXISTS (SELECT 1 FROM public.group_members gm
                       WHERE gm.group_id = v_group.group_id AND gm.role = 'founder'
                         AND gm.user_id <> ALL (v_accounts)) THEN
      UPDATE public.group_members SET role = 'founder' WHERE id = v_next.id;
      UPDATE public.groups SET created_by = v_next.user_id
       WHERE id = v_group.group_id AND created_by = ANY (v_accounts);
      v_handed := v_handed + 1;
    END IF;
  END LOOP;

  FOREACH v_account IN ARRAY v_accounts LOOP
    -- A ticket someone paid for (or was refunded) is the organiser's record
    -- too; a free or unpaid registration is only the person's own.
    DELETE FROM public.event_attendees
     WHERE user_id = v_account AND payment_status NOT IN ('paid', 'refunded');
    UPDATE public.event_attendees SET guest_name = 'Deleted account'
     WHERE user_id = v_account AND guest_name IS NULL;

    -- Every page the account's actor owns.
    FOR v_actor IN SELECT id FROM public.actors WHERE user_id = v_account LOOP
      FOR v_table IN
        SELECT oc.table_name FROM public.actor_owner_columns() oc WHERE oc.column_name = 'actor_id'
      LOOP
        EXECUTE format('DELETE FROM public.%I WHERE actor_id = $1', v_table.table_name)
          USING v_actor;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_pages := v_pages + v_rows;
      END LOOP;
    END LOOP;

    -- The account itself: profile, actor and the person's own data cascade.
    DELETE FROM auth.users WHERE id = v_account;
  END LOOP;

  RETURN jsonb_build_object('accounts', cardinality(v_accounts), 'pages', v_pages,
                            'groups_handed_over', v_handed,
                            'groups_unpublished', v_unpublished);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account(uuid) TO service_role;

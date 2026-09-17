-- Make "this function writes a column that does not exist" a thing we can see.
--
-- Nineteen functions were in that state on 2026-08-28, and had been for as long
-- as anyone can tell. Likes, dislikes, replies, deleting a post and quote
-- replies were all dead in production; four AI-withdrawal functions and both
-- nearby-search functions are dead too. Every one of them looked fine: the
-- function exists, `\df` lists it, PostgREST routes to it, and the app calls it
-- happily. plpgsql only plans a statement when it RUNS, so a reference to a
-- column that was never added raises 42703 at call time and at no other moment.
--
-- Nothing in the stack could have caught it. Unit tests mock the database. The
-- RPC-existence gate (scripts/check-rpc-exists.mjs) proves a function is
-- DEFINED, which every one of these was. Migration replay proves the SQL
-- applies, which it does — creating a function never validates its body.
-- Existence and correctness came apart, and only correctness matters.
--
-- plpgsql_check reads every function body against the live schema and reports
-- exactly this. Exposed here as a COUNT over PostgREST, matching
-- count_email_derived_usernames, so the nightly data-invariant gate can ratchet
-- it down and never up.
--
-- LIMITS, stated because a gate that is trusted beyond its reach is worse than
-- none. This is a STATIC check: it sees undefined columns, tables and type
-- mismatches. It does NOT evaluate constraints, so a NOT NULL column left
-- unset or a value outside a CHECK still fails only at runtime — both of which
-- create_quote_reply also did, hiding behind the static error until it was
-- fixed. Trigger functions are skipped because plpgsql_check needs a relation
-- to check them against.

CREATE EXTENSION IF NOT EXISTS plpgsql_check;

CREATE OR REPLACE FUNCTION public.count_broken_plpgsql_functions()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(DISTINCT p.oid)::bigint
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  CROSS JOIN LATERAL plpgsql_check_function_tb(p.oid) cf
  WHERE n.nspname = 'public'
    AND l.lanname = 'plpgsql'
    AND p.prorettype <> 'trigger'::regtype
    AND cf.level = 'error';
$$;

-- Same lock-down as the other invariant helpers: the list of broken functions
-- is a map of what is currently exploitable-by-accident, so it returns a number
-- and only service_role may ask.
REVOKE ALL ON FUNCTION public.count_broken_plpgsql_functions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_broken_plpgsql_functions() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_broken_plpgsql_functions() TO service_role;

COMMENT ON FUNCTION public.count_broken_plpgsql_functions() IS
  'How many plpgsql functions reference a column, table or type that does not exist. Static only — constraints still fail at runtime. A ratchet for check-data-invariants.mjs: it may fall or hold, never rise.';

-- The names, for a human fixing them. Kept separate from the count so the gate
-- can stay a number while a person can still ask "which ones?".
CREATE OR REPLACE FUNCTION public.list_broken_plpgsql_functions()
RETURNS TABLE(function_name text, problem text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.proname::text, cf.message::text
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  CROSS JOIN LATERAL plpgsql_check_function_tb(p.oid) cf
  WHERE n.nspname = 'public'
    AND l.lanname = 'plpgsql'
    AND p.prorettype <> 'trigger'::regtype
    AND cf.level = 'error'
  ORDER BY 1;
$$;

REVOKE ALL ON FUNCTION public.list_broken_plpgsql_functions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_broken_plpgsql_functions() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_broken_plpgsql_functions() TO service_role;

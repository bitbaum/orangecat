-- Six public.* tables had row level security DISABLED, and every one of them
-- answered the ANON key — the key that ships inside the browser bundle.
--
-- Found 2026-09-12 by .claude/commands/db-check.sh, on the first run after it
-- was rewritten to ask the database instead of printing MCP commands at you.
-- Verified by fetching each one over PostgREST with NEXT_PUBLIC_SUPABASE_ANON_KEY:
--
--   _backup_cat_messages_20260703        200, 18 rows of users' Cat messages,
--                                        e.g. "I offer haircuts at home in
--                                        Zürich, 40 CHF" — private content
--   _backup_cat_conversations_20260703   200, user_id per conversation
--   user_nudges                          200, user_id + personalised prompts
--   content_embeddings                   200, entity vectors
--   _deploy_schema_history               200, deploy metadata
--   schema_migrations                    200, deploy metadata
--
-- Every sibling user_* table already had RLS on; these were the gap, inherited
-- from the baseline schema dump where they were created without it.
--
-- No policies are added, deliberately. RLS with zero policies means: anon and
-- authenticated see NOTHING, service_role bypasses, and the postgres superuser
-- bypasses. That is exactly the access these six already have in practice:
--
--   * user_nudges is read and written ONLY through createAdminClient(), with an
--     explicit user_id filter on every query — src/app/api/cat/nudges/route.ts
--     says so in two comments, and the reason it gives is that this table had no
--     policies to lean on. Enabling RLS changes nothing for that path.
--   * content_embeddings is reached via searchPlatform(createAdminClient(), …)
--     in src/app/api/v1/search/route.ts, and by reindexService server-side. No
--     browser code touches it.
--   * schema_migrations and _deploy_schema_history are written by
--     scripts/apply-migrations.sh through `docker exec supabase-db psql` as
--     postgres, which bypasses RLS.
--   * the two _backup_ tables have no reader at all. They are a July snapshot.
--
-- So this closes six public reads and moves no legitimate one.

-- IF EXISTS on every line, and not out of vagueness: all six were confirmed
-- present before this was written. It is because a migration that cannot run
-- aborts the deploy and blocks EVERY later PR behind it, and two of these are
-- dated backup tables whose whole purpose is to be dropped one day. A security
-- fix that freezes the pipeline the week someone tidies up a July snapshot is a
-- worse outcome than the fix is a good one.

ALTER TABLE IF EXISTS public._backup_cat_conversations_20260703 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public._backup_cat_messages_20260703      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_nudges                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.content_embeddings                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public._deploy_schema_history             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.schema_migrations                  ENABLE ROW LEVEL SECURITY;

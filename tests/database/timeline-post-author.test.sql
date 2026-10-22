-- Run only in an empty disposable PostgreSQL database, with psql ON_ERROR_STOP=1.
-- Creating auth fails immediately on an existing Supabase database.
BEGIN;

CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
CREATE TABLE profiles(id uuid PRIMARY KEY);
INSERT INTO profiles VALUES ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
CREATE TABLE timeline_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_type text, actor_id uuid REFERENCES profiles(id), actor_type text, subject_type text, subject_id uuid, title text, description text, content jsonb, visibility text, metadata jsonb, event_timestamp timestamptz, created_at timestamptz, updated_at timestamptz, is_deleted boolean DEFAULT false);
CREATE TABLE timeline_event_visibility(event_id uuid REFERENCES timeline_events(id), timeline_type text, timeline_owner_id uuid, UNIQUE(event_id,timeline_type,timeline_owner_id));

\ir ../../supabase/migrations/20261022163000_validate_post_author_identity.sql
DO $$
DECLARE result jsonb; i integer;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  result := public.create_post_with_visibility('post', '11111111-1111-1111-1111-111111111111', p_description => 'Unauthenticated');
  IF result->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Unauthenticated author accepted'; END IF;

  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  result := public.create_post_with_visibility('post', '11111111-1111-1111-1111-111111111111', p_description => 'Different author');
  IF result->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Different author accepted'; END IF;
  IF EXISTS (SELECT 1 FROM timeline_events) THEN RAISE EXCEPTION 'Rejected write inserted data'; END IF;

  result := public.create_post_with_visibility('post', NULL, p_description => 'Own author');
  IF result->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Own author rejected'; END IF;
  IF NOT EXISTS (SELECT 1 FROM timeline_events WHERE actor_id = auth.uid()) THEN RAISE EXCEPTION 'Wrong stored author'; END IF;
  IF (SELECT count(*) FROM timeline_event_visibility) <> 1 THEN RAISE EXCEPTION 'Default profile context missing'; END IF;
  result := public.create_post_with_visibility('post', auth.uid(), p_description => 'Own author');
  IF result->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Duplicate accepted'; END IF;

  FOR i IN 2..5 LOOP
    result := public.create_post_with_visibility('post', auth.uid(), p_description => 'Own post ' || i);
    IF result->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Own post % rejected', i; END IF;
  END LOOP;
  result := public.create_post_with_visibility('post', auth.uid(), p_description => 'Sixth post');
  IF result->>'success' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Rate limit not enforced'; END IF;
END;
$$;
ROLLBACK;

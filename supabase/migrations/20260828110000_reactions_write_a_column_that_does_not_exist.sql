-- Likes, dislikes and replies have never worked. This is why.
--
-- Six functions end with a line writing a column that does not exist:
--
--   -- Update timeline_events.like_count if column exists
--   UPDATE timeline_events SET like_count = v_count WHERE id = p_event_id;
--
-- `timeline_events` has no count columns at all — never has. The comment says
-- "if column exists", but plpgsql has no such conditional: the statement is
-- planned when the function runs and raises 42703, `column "like_count" of
-- relation "timeline_events" does not exist`.
--
-- Because a function body is one transaction, the exception rolls back the
-- INSERT that ran three lines earlier. So the like is written, then unwritten,
-- and the caller gets an error. The UI does the rest of the damage invisibly:
-- it applies an optimistic update, sees `success: false`, and rolls back — so
-- the heart fills for ~150ms and empties again. Nothing is logged where anyone
-- would look, and the button never appears broken, only unresponsive.
--
-- Verified in production 2026-08-28 by clicking Like on orangecat.ch/timeline
-- and reading the response: HTTP 400, code 42703.
--
-- Affected, all reachable from the app:
--   like_timeline_event / unlike_timeline_event          → likes
--   dislike_timeline_event / undislike_timeline_event    → dislikes
--   add_timeline_comment                                 → replies
--   delete_timeline_comment                              → deleting a reply
--
-- THE FIX is to delete that line, and nothing else. Every one of these already
-- upserts `timeline_event_stats`, which is the real home for counts
-- (like_count, dislike_count, comment_count, share_count, view_count) and what
-- the read path already reads. The bad line was a second, non-existent copy of
-- a number that was being stored correctly one line above — so removing it
-- loses nothing and restores the single source of truth.
--
-- Bodies below are the LIVE definitions, taken from pg_get_functiondef, with
-- only that line (and its comment) removed. Reproducing them from the baseline
-- migration instead would risk reverting whatever else has been replaced since.

CREATE OR REPLACE FUNCTION public.add_timeline_comment(p_event_id uuid, p_user_id uuid, p_content text, p_parent_comment_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(comment_id uuid, comment_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_comment_id UUID;
  v_count INTEGER;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Insert the comment
  INSERT INTO timeline_comments (event_id, user_id, content, parent_comment_id)
  VALUES (p_event_id, p_user_id, p_content, p_parent_comment_id)
  RETURNING id INTO v_comment_id;

  -- Get the updated count (only top-level comments)
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM timeline_comments
  WHERE event_id = p_event_id AND is_deleted = false AND parent_comment_id IS NULL;

  -- Update cached stats
  INSERT INTO timeline_event_stats (event_id, comment_count, updated_at)
  VALUES (p_event_id, v_count, NOW())
  ON CONFLICT (event_id) DO UPDATE SET comment_count = v_count, updated_at = NOW();


  RETURN QUERY SELECT v_comment_id, v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_timeline_comment(p_comment_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id UUID;
  v_count INTEGER;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get event_id before deleting
  SELECT event_id INTO v_event_id
  FROM timeline_comments WHERE id = p_comment_id AND user_id = p_user_id;

  IF v_event_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Soft delete the comment
  UPDATE timeline_comments
  SET is_deleted = true, deleted_at = NOW()
  WHERE id = p_comment_id AND user_id = p_user_id;

  -- Update count
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM timeline_comments
  WHERE event_id = v_event_id AND is_deleted = false AND parent_comment_id IS NULL;

  -- Update cached stats
  UPDATE timeline_event_stats SET comment_count = v_count, updated_at = NOW()
  WHERE event_id = v_event_id;


  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dislike_timeline_event(p_event_id uuid, p_user_id uuid)
 RETURNS TABLE(dislike_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Insert the dislike (ignore if already exists)
  INSERT INTO timeline_dislikes (event_id, user_id)
  VALUES (p_event_id, p_user_id)
  ON CONFLICT (event_id, user_id) DO NOTHING;

  -- Remove any existing like
  DELETE FROM timeline_likes
  WHERE event_id = p_event_id AND user_id = p_user_id;

  -- Get the updated count
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM timeline_dislikes WHERE event_id = p_event_id;

  -- Update cached stats
  INSERT INTO timeline_event_stats (event_id, dislike_count, updated_at)
  VALUES (p_event_id, v_count, NOW())
  ON CONFLICT (event_id) DO UPDATE SET dislike_count = v_count, updated_at = NOW();


  RETURN QUERY SELECT v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.like_timeline_event(p_event_id uuid, p_user_id uuid)
 RETURNS TABLE(like_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Insert the like (ignore if already exists)
  INSERT INTO timeline_likes (event_id, user_id)
  VALUES (p_event_id, p_user_id)
  ON CONFLICT (event_id, user_id) DO NOTHING;

  -- Remove any existing dislike
  DELETE FROM timeline_dislikes
  WHERE event_id = p_event_id AND user_id = p_user_id;

  -- Get the updated count
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM timeline_likes WHERE event_id = p_event_id;

  -- Update cached stats
  INSERT INTO timeline_event_stats (event_id, like_count, updated_at)
  VALUES (p_event_id, v_count, NOW())
  ON CONFLICT (event_id) DO UPDATE SET like_count = v_count, updated_at = NOW();


  RETURN QUERY SELECT v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.undislike_timeline_event(p_event_id uuid, p_user_id uuid)
 RETURNS TABLE(dislike_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Remove the dislike
  DELETE FROM timeline_dislikes
  WHERE event_id = p_event_id AND user_id = p_user_id;

  -- Get the updated count
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM timeline_dislikes WHERE event_id = p_event_id;

  -- Update cached stats
  INSERT INTO timeline_event_stats (event_id, dislike_count, updated_at)
  VALUES (p_event_id, v_count, NOW())
  ON CONFLICT (event_id) DO UPDATE SET dislike_count = v_count, updated_at = NOW();


  RETURN QUERY SELECT v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.unlike_timeline_event(p_event_id uuid, p_user_id uuid)
 RETURNS TABLE(like_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Remove the like
  DELETE FROM timeline_likes
  WHERE event_id = p_event_id AND user_id = p_user_id;

  -- Get the updated count
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM timeline_likes WHERE event_id = p_event_id;

  -- Update cached stats
  INSERT INTO timeline_event_stats (event_id, like_count, updated_at)
  VALUES (p_event_id, v_count, NOW())
  ON CONFLICT (event_id) DO UPDATE SET like_count = v_count, updated_at = NOW();


  RETURN QUERY SELECT v_count;
END;
$function$;


-- ---------------------------------------------------------------------------
-- Deleting a post has never worked either, for two independent reasons.
--
-- One: the ownership check reads `SELECT user_id FROM profiles WHERE role =
-- 'admin'`. `profiles` has neither column — it keys on `id` and has no `role`
-- at all — so the IF raised 42703 on every call and no post was ever deleted.
-- The admin escape hatch it was reaching for has therefore never existed;
-- removing it takes away nothing that ever worked, and leaves the honest rule:
-- you can delete your own posts. A real moderator capability should be built
-- deliberately, against a table that exists, not inherited from a line that
-- always threw.
--
-- Two, and this one would have bitten even after fixing the first: the function
-- set only `deleted_at`, while every read path filters on `is_deleted = false`
-- (services/timeline/queries/*). A post "deleted" this way would have stayed
-- fully visible. Confirmed against production: 102 events have both flags set,
-- and ZERO have `deleted_at` without `is_deleted` — nothing has ever taken this
-- path. Both flags are now set together, and the reason goes in the
-- `deletion_reason` COLUMN that already exists rather than being stuffed into
-- metadata beside it.
--
-- The trailing "decrement the parent's reply_count" block is dropped: that
-- column does not exist either, so it never ran.
CREATE OR REPLACE FUNCTION public.soft_delete_timeline_event(event_id uuid, reason text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_id UUID;
  v_rows INTEGER := 0;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE timeline_events
  SET is_deleted = TRUE,
      deleted_at = NOW(),
      deletion_reason = reason,
      updated_at = NOW()
  WHERE id = event_id
    AND actor_id = v_actor_id
    AND is_deleted IS NOT TRUE;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    -- Deleting something already deleted is the user's intent already
    -- satisfied, not a failure to report. Only a post that is not theirs (or
    -- does not exist) is an error.
    IF EXISTS (
      SELECT 1 FROM timeline_events
      WHERE id = event_id AND actor_id = v_actor_id
    ) THEN
      RETURN TRUE;
    END IF;
    RAISE EXCEPTION 'Event not found or access denied';
  END IF;

  RETURN TRUE;
END;
$function$;

-- ---------------------------------------------------------------------------
-- A quote reply could not be created, and would have rendered blank if it had.
--
-- `timeline_events.content` is jsonb and the function assigned the text
-- parameter straight into it, which plpgsql_check reports as "column content is
-- of type jsonb but expression is of type text". It also incremented
-- `quote_count`, another column that does not exist.
--
-- The rendering half matters just as much: PostContent reads
-- `event.description`, and this function never wrote one. So a quote reply that
-- somehow succeeded would have appeared as an empty post — which is the shape
-- of "reposts look broken" rather than "reposts error". Both are written now,
-- `description` for the reader and `content` in the {text: …} shape the rest of
-- the timeline uses, so the two cannot disagree about what the post says.
CREATE OR REPLACE FUNCTION public.create_quote_reply(p_parent_event_id uuid, p_actor_id uuid, p_content text, p_quoted_content text, p_visibility text DEFAULT 'public'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_event_id UUID;
  v_parent_actor_id UUID;
BEGIN
  IF auth.uid() != p_actor_id THEN
    RAISE EXCEPTION 'Actor mismatch';
  END IF;

  SELECT actor_id INTO v_parent_actor_id
  FROM timeline_events
  WHERE id = p_parent_event_id
    AND is_deleted IS NOT TRUE;

  IF v_parent_actor_id IS NULL THEN
    RAISE EXCEPTION 'Parent event not found';
  END IF;

  -- `subject_type` is NOT NULL and was never supplied, so this INSERT could not
  -- have succeeded on any input — a third failure, hiding behind the first two
  -- and invisible to plpgsql_check, which does not evaluate constraints. Every
  -- one of the 1,406 existing rows sets subject_type and subject_id; a post
  -- authored by a person is ('profile', that person), which is what the
  -- formatter already assumes when it defaults subjectType to 'profile'.
  INSERT INTO timeline_events (
    event_type,
    actor_id,
    subject_type,
    subject_id,
    title,
    description,
    content,
    parent_event_id,
    visibility,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    'quote_reply',
    p_actor_id,
    'profile',
    p_actor_id,
    'Quoted a post',
    p_content,
    jsonb_build_object('text', p_content),
    p_parent_event_id,
    p_visibility,
    jsonb_build_object(
      'quoted_content', p_quoted_content,
      'quoted_actor_id', v_parent_actor_id
    ),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_new_event_id;

  -- The notification insert named four columns `notifications` does not have
  -- (actor_id, title, data) and used a `type` its CHECK constraint forbids
  -- ('quote_reply'). Only the first of those is visible to plpgsql_check — a
  -- constraint violation is a runtime failure — so this had two more ways to
  -- fail after the obvious one was fixed.
  --
  -- The real shape is (user_id, type, message, metadata, is_read, created_at,
  -- read_at, action_url). `comment` is the allowed type that means what this
  -- means: somebody responded to your post. The quote-ness is kept in metadata
  -- rather than invented as a new type, because adding a type means widening
  -- the constraint AND teaching the notification UI to render it — a deliberate
  -- change, not a side effect of repairing a broken function.
  IF v_parent_actor_id != p_actor_id THEN
    INSERT INTO notifications (
      user_id,
      type,
      message,
      metadata,
      action_url,
      created_at
    ) VALUES (
      v_parent_actor_id,
      'comment',
      LEFT(p_content, 100),
      jsonb_build_object(
        'kind', 'quote_reply',
        'event_id', v_new_event_id,
        'parent_event_id', p_parent_event_id,
        'actor_id', p_actor_id
      ),
      '/post/' || v_new_event_id::text,
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_new_event_id;
END;
$function$;

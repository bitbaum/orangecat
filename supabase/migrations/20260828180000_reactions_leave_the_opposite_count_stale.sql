-- Liking a post you disliked leaves the dislike count claiming you still do.
--
-- `like_timeline_event` deletes any existing dislike row (the two are meant to
-- be exclusive) and then recomputes and stores ONLY `like_count`.
-- `dislike_timeline_event` is the mirror image. So the count belonging to the
-- reaction that was just removed keeps whatever value it had.
--
-- Measured in production 2026-08-28 by liking a post and then disliking it:
--
--   timeline_likes           no row for (event, user)   ← correctly deleted
--   timeline_event_stats     like_count = 1             ← never recomputed
--                            dislike_count = 1
--
-- The number is wrong for everyone, not just the person who clicked, and stays
-- wrong: nothing recomputes these except the next reaction on the same post.
-- The UI reads `timeline_event_stats`, so the post shows one like that does not
-- exist.
--
-- The fix is to recompute BOTH counts whenever either changes, because either
-- change can move both. Each function now returns both, so the client can stop
-- inferring the other one — see the matching change in usePostLikeDislike,
-- which used to leave the opposite button lit because the response never
-- mentioned it.
--
-- Toggle-off (unlike/undislike) cannot affect the opposite count, but they
-- return both for one shape across all four: a caller that has to remember
-- which of four responses carries which field will eventually get it wrong.

DROP FUNCTION IF EXISTS public.like_timeline_event(uuid, uuid);
CREATE FUNCTION public.like_timeline_event(p_event_id uuid, p_user_id uuid)
 RETURNS TABLE(like_count integer, dislike_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_likes INTEGER;
  v_dislikes INTEGER;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO timeline_likes (event_id, user_id)
  VALUES (p_event_id, p_user_id)
  ON CONFLICT (event_id, user_id) DO NOTHING;

  -- A like retracts a dislike. Both totals move, so both are recounted.
  DELETE FROM timeline_dislikes
  WHERE event_id = p_event_id AND user_id = p_user_id;

  SELECT COUNT(*)::INTEGER INTO v_likes FROM timeline_likes WHERE event_id = p_event_id;
  SELECT COUNT(*)::INTEGER INTO v_dislikes FROM timeline_dislikes WHERE event_id = p_event_id;

  INSERT INTO timeline_event_stats (event_id, like_count, dislike_count, updated_at)
  VALUES (p_event_id, v_likes, v_dislikes, NOW())
  ON CONFLICT (event_id) DO UPDATE
    SET like_count = v_likes, dislike_count = v_dislikes, updated_at = NOW();

  RETURN QUERY SELECT v_likes, v_dislikes;
END;
$function$;

DROP FUNCTION IF EXISTS public.dislike_timeline_event(uuid, uuid);
CREATE FUNCTION public.dislike_timeline_event(p_event_id uuid, p_user_id uuid)
 RETURNS TABLE(like_count integer, dislike_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_likes INTEGER;
  v_dislikes INTEGER;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO timeline_dislikes (event_id, user_id)
  VALUES (p_event_id, p_user_id)
  ON CONFLICT (event_id, user_id) DO NOTHING;

  DELETE FROM timeline_likes
  WHERE event_id = p_event_id AND user_id = p_user_id;

  SELECT COUNT(*)::INTEGER INTO v_likes FROM timeline_likes WHERE event_id = p_event_id;
  SELECT COUNT(*)::INTEGER INTO v_dislikes FROM timeline_dislikes WHERE event_id = p_event_id;

  INSERT INTO timeline_event_stats (event_id, like_count, dislike_count, updated_at)
  VALUES (p_event_id, v_likes, v_dislikes, NOW())
  ON CONFLICT (event_id) DO UPDATE
    SET like_count = v_likes, dislike_count = v_dislikes, updated_at = NOW();

  RETURN QUERY SELECT v_likes, v_dislikes;
END;
$function$;

DROP FUNCTION IF EXISTS public.unlike_timeline_event(uuid, uuid);
CREATE FUNCTION public.unlike_timeline_event(p_event_id uuid, p_user_id uuid)
 RETURNS TABLE(like_count integer, dislike_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_likes INTEGER;
  v_dislikes INTEGER;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM timeline_likes
  WHERE event_id = p_event_id AND user_id = p_user_id;

  SELECT COUNT(*)::INTEGER INTO v_likes FROM timeline_likes WHERE event_id = p_event_id;
  SELECT COUNT(*)::INTEGER INTO v_dislikes FROM timeline_dislikes WHERE event_id = p_event_id;

  INSERT INTO timeline_event_stats (event_id, like_count, dislike_count, updated_at)
  VALUES (p_event_id, v_likes, v_dislikes, NOW())
  ON CONFLICT (event_id) DO UPDATE
    SET like_count = v_likes, dislike_count = v_dislikes, updated_at = NOW();

  RETURN QUERY SELECT v_likes, v_dislikes;
END;
$function$;

DROP FUNCTION IF EXISTS public.undislike_timeline_event(uuid, uuid);
CREATE FUNCTION public.undislike_timeline_event(p_event_id uuid, p_user_id uuid)
 RETURNS TABLE(like_count integer, dislike_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_likes INTEGER;
  v_dislikes INTEGER;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM timeline_dislikes
  WHERE event_id = p_event_id AND user_id = p_user_id;

  SELECT COUNT(*)::INTEGER INTO v_likes FROM timeline_likes WHERE event_id = p_event_id;
  SELECT COUNT(*)::INTEGER INTO v_dislikes FROM timeline_dislikes WHERE event_id = p_event_id;

  INSERT INTO timeline_event_stats (event_id, like_count, dislike_count, updated_at)
  VALUES (p_event_id, v_likes, v_dislikes, NOW())
  ON CONFLICT (event_id) DO UPDATE
    SET like_count = v_likes, dislike_count = v_dislikes, updated_at = NOW();

  RETURN QUERY SELECT v_likes, v_dislikes;
END;
$function$;

-- DROP + CREATE was forced by the changed return type, and dropping takes the
-- grants with it. Restored explicitly to exactly what these had before
-- (PUBLIC, anon, authenticated, service_role) rather than relying on the
-- default: a reaction that silently stops being callable by `authenticated`
-- would look exactly like the bug this migration is fixing.
GRANT EXECUTE ON FUNCTION public.like_timeline_event(uuid, uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dislike_timeline_event(uuid, uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unlike_timeline_event(uuid, uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.undislike_timeline_event(uuid, uuid) TO PUBLIC, anon, authenticated, service_role;

-- Repair the rows already skewed by this. Recount from the membership tables,
-- which have been right the whole time — only the cache drifted.
UPDATE timeline_event_stats s
SET like_count = c.likes,
    dislike_count = c.dislikes,
    updated_at = NOW()
FROM (
  SELECT e.id,
         (SELECT COUNT(*)::INTEGER FROM timeline_likes l WHERE l.event_id = e.id) AS likes,
         (SELECT COUNT(*)::INTEGER FROM timeline_dislikes d WHERE d.event_id = e.id) AS dislikes
  FROM timeline_events e
) c
WHERE s.event_id = c.id
  AND (s.like_count IS DISTINCT FROM c.likes OR s.dislike_count IS DISTINCT FROM c.dislikes);

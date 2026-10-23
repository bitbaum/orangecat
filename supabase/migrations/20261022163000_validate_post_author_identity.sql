-- Enforce author identity inside the legacy SECURITY DEFINER post writer.
-- Preserve the existing signature, response envelope, visibility, dedup and limits.

CREATE OR REPLACE FUNCTION public.create_post_with_visibility(p_event_type text, p_actor_id uuid, p_subject_type text DEFAULT 'profile'::text, p_subject_id uuid DEFAULT NULL::uuid, p_title text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_visibility text DEFAULT 'public'::text, p_metadata jsonb DEFAULT '{}'::jsonb, p_timeline_contexts jsonb DEFAULT '[]'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_actor_id           uuid;
  v_event_id           uuid;
  v_title              text;
  v_context            jsonb;
  v_visibility_count   integer := 0;
  v_normalized_desc    text;
  v_recent_post_count  integer;
BEGIN
  v_actor_id := COALESCE(p_actor_id, auth.uid());

  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Authentication required'
    );
  END IF;

  -- SECURITY DEFINER bypasses table RLS. This legacy timeline actor is a
  -- profiles(id) value, so enforce the same identity as auth.uid() here.
  IF v_actor_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only publish as yourself'
    );
  END IF;

  -- Rate limit: max 5 posts per actor per minute. Sustained spam (adelina x9)
  -- hits this; a single duplicate within minutes hits the dedup check below.
  SELECT COUNT(*) INTO v_recent_post_count
  FROM timeline_events
  WHERE actor_id  = v_actor_id
    AND event_timestamp > now() - interval '1 minute'
    AND NOT COALESCE(is_deleted, false);

  IF v_recent_post_count >= 5 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'You are posting too quickly. Wait a moment and try again.'
    );
  END IF;

  -- Dedup: identical description from same actor within the last 5 minutes
  -- is almost always an accidental repost (network retry, double-click).
  -- Skip the check for empty/null bodies so non-text events aren't affected.
  v_normalized_desc := NULLIF(TRIM(p_description), '');
  IF v_normalized_desc IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM timeline_events
      WHERE actor_id        = v_actor_id
        AND TRIM(description) = v_normalized_desc
        AND event_timestamp > now() - interval '5 minutes'
        AND NOT COALESCE(is_deleted, false)
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error',   'You just posted this. Edit it or wait a few minutes before reposting.'
      );
    END IF;
  END IF;

  v_title := COALESCE(
    NULLIF(TRIM(p_title), ''),
    NULLIF(LEFT(TRIM(p_description), 140), ''),
    'Update'
  );

  INSERT INTO timeline_events (
    event_type, actor_id, actor_type, subject_type, subject_id,
    title, description, content, visibility, metadata,
    event_timestamp, created_at, updated_at
  ) VALUES (
    p_event_type, v_actor_id, 'user', p_subject_type, p_subject_id,
    v_title, p_description,
    jsonb_build_object('text', COALESCE(p_description, '')),
    p_visibility, p_metadata,
    now(), now(), now()
  )
  RETURNING id INTO v_event_id;

  IF p_timeline_contexts IS NOT NULL AND jsonb_array_length(p_timeline_contexts) > 0 THEN
    FOR v_context IN SELECT * FROM jsonb_array_elements(p_timeline_contexts) LOOP
      INSERT INTO timeline_event_visibility (event_id, timeline_type, timeline_owner_id)
      VALUES (v_event_id, v_context->>'timeline_type', (v_context->>'timeline_owner_id')::uuid)
      ON CONFLICT (event_id, timeline_type, timeline_owner_id) DO NOTHING;
      v_visibility_count := v_visibility_count + 1;
    END LOOP;
  END IF;

  INSERT INTO timeline_event_visibility (event_id, timeline_type, timeline_owner_id)
  VALUES (v_event_id, 'profile', v_actor_id)
  ON CONFLICT (event_id, timeline_type, timeline_owner_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success',          true,
    'post_id',          v_event_id,
    'visibility_count', v_visibility_count + 1
  );
END;
$$;

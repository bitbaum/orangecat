-- Reputation hardening (ADR-0010). A review of the shipped schema found three
-- ways a signed-in person could bend the record by writing to the database API
-- directly, around the app:
--
-- 1. A seller could bury their own track record. A person's deals are filed
--    against their OLDEST user actor (primary_user_actor()), and anyone may
--    insert a user actor for themselves with any created_at. One back-dated
--    actor became "primary", the profile showed its empty record, and every
--    review vanished from view.
-- 2. A buyer could publish text moderation cannot hide. `answers` was checked
--    only for being yes/no values; its KEYS were free. The profile printed an
--    unknown key as if it were a question, and hiding a review hides `body`
--    only — so "This seller is a fraud, call +41…" as a key stayed public.
-- 3. The stored SHA-256 of a review or reply was whatever the writer sent, so
--    "the record and its hash stay" proved nothing.
--
-- Rollback: DROP TRIGGER actors_created_at_is_the_servers ON public.actors;
--   DROP FUNCTION public.actors_created_at_is_the_servers();
--   DROP TRIGGER deal_review_replies_hash_is_computed ON public.deal_review_replies;
--   DROP FUNCTION public.deal_review_reply_is_hashed();
--   restore deal_review_is_placed() from 20261005120000;
--   DROP FUNCTION public.deal_review_question_ids(TEXT);

-- ==================== 1. WHEN AN ACTOR WAS CREATED IS NOT A CHOICE ====================

-- Only for people writing through PostgREST. The service role and migrations
-- keep the ability to set it (imports, backfills).
CREATE OR REPLACE FUNCTION public.actors_created_at_is_the_servers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.created_at := now();
    ELSE
      NEW.created_at := OLD.created_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS actors_created_at_is_the_servers ON public.actors;
CREATE TRIGGER actors_created_at_is_the_servers
  BEFORE INSERT OR UPDATE ON public.actors
  FOR EACH ROW
  EXECUTE FUNCTION public.actors_created_at_is_the_servers();

-- ==================== 2. ONLY THE QUESTIONS WE ASK ====================

-- Mirrors REVIEW_QUESTIONS in src/config/reputation.ts; the unit test
-- reputation-cannot-be-gamed pins the two together, so one cannot change alone.
CREATE OR REPLACE FUNCTION public.deal_review_question_ids(p_role TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_role
    WHEN 'customer' THEN ARRAY['would_deal_again', 'as_described', 'on_time', 'communicated']
    WHEN 'provider' THEN ARRAY['would_deal_again', 'clear_request', 'communicated']
    ELSE ARRAY[]::TEXT[]
  END;
$$;

-- deal_review_is_placed() as in 20261005120000, plus: answers carry only the
-- reviewer's side's questions and always the headline one; the body's hash is
-- computed here, never taken from the writer.
CREATE OR REPLACE FUNCTION public.deal_review_is_placed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.deals%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.deals WHERE id = NEW.deal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such deal.' USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF now() > d.review_closes_at THEN
    RAISE EXCEPTION 'The review window for this deal has closed.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.reviewer_actor_id = d.customer_actor_id THEN
    NEW.reviewer_role := 'customer';
    NEW.subject_actor_id := d.provider_actor_id;
  ELSIF NEW.reviewer_actor_id = d.provider_actor_id THEN
    NEW.reviewer_role := 'provider';
    NEW.subject_actor_id := d.customer_actor_id;
  ELSE
    RAISE EXCEPTION 'Only the two people in a deal can review it.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(NEW.answers) AS k
    WHERE k <> ALL (public.deal_review_question_ids(NEW.reviewer_role))
  ) THEN
    RAISE EXCEPTION 'A review answers only the questions asked.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT NEW.answers ? 'would_deal_again' THEN
    RAISE EXCEPTION 'Every review says whether you would deal with them again.'
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.body_sha256 := CASE
    WHEN NEW.body IS NULL THEN NULL
    ELSE encode(sha256(convert_to(NEW.body, 'UTF8')), 'hex')
  END;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

-- ==================== 3. A REPLY'S HASH IS COMPUTED TOO ====================

CREATE OR REPLACE FUNCTION public.deal_review_reply_is_hashed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.body_sha256 := encode(sha256(convert_to(NEW.body, 'UTF8')), 'hex');
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deal_review_replies_hash_is_computed ON public.deal_review_replies;
CREATE TRIGGER deal_review_replies_hash_is_computed
  BEFORE INSERT ON public.deal_review_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.deal_review_reply_is_hashed();

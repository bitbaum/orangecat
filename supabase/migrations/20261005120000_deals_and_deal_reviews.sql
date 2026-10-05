-- Reputation: a review exists only because a deal did. (ADR-0010)
--
-- Google-style reviews are opinions from anyone. OrangeCat sees the deal
-- itself, so reputation here is built from two things, in this order:
--
--   1. DEALS — what the platform observed: who provided what to whom, that it
--      settled, and how it ended. Nobody writes these; they are recorded.
--   2. DEAL REVIEWS — what the two people said about each other, and only
--      about a deal they were both party to.
--
-- Fleet-wide by design. OrangeCat is the identity root (ADR-0009), so deals
-- from evig (technician jobs) and Loki (paid crew assignments) land in the
-- same table, keyed by OrangeCat actor ids, and one track record follows a
-- person across every product. `source` names where a deal came from; the
-- list is src/config/reputation.ts (validated by zod, deliberately not a
-- CHECK). OrangeCat orders arrive through the trigger below. Other products
-- write through the service role.
--
-- Tips are not deals. A gift tests nothing about whether anyone delivered, so
-- no tip ever becomes a deal, and no tip can be reviewed.
--
-- What makes a review worth reading:
--   * one review per side per deal, and only by that side;
--   * BLIND until both sides have written or the window closes, after which
--     nobody can write. Nobody can read the other's review and retaliate;
--   * append-only with the body's SHA-256 beside it, like research_reviews:
--     a changed mind is never an edit;
--   * no stars. `answers` holds yes/no questions (src/config/reputation.ts).
--
-- Deals are private to their two parties. The public sees aggregates only
-- (actor_track_record) and the reviews people chose to post.

-- ==================== THE REVIEW WINDOW ====================

-- The one place the window length lives. The column default and the backfill
-- both call it; the app reads review_closes_at off the row, never a constant.
CREATE OR REPLACE FUNCTION public.deal_review_window()
RETURNS interval
LANGUAGE sql
IMMUTABLE
AS $$ SELECT interval '30 days' $$;

-- ==================== DEALS ====================

CREATE TABLE IF NOT EXISTS public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source ~ '^[a-z]+\.[a-z_]+$'),
  source_ref TEXT NOT NULL CHECK (char_length(source_ref) BETWEEN 1 AND 200),
  provider_actor_id UUID NOT NULL REFERENCES public.actors(id) ON DELETE CASCADE,
  customer_actor_id UUID NOT NULL REFERENCES public.actors(id) ON DELETE CASCADE,
  entity_type TEXT,
  entity_id UUID,
  title TEXT NOT NULL CHECK (char_length(title) >= 1),
  amount NUMERIC(20, 8) CHECK (amount IS NULL OR amount > 0),
  currency TEXT CHECK (currency IS NULL OR currency ~ '^[A-Z]{3,4}$'),
  status TEXT NOT NULL DEFAULT 'settled',
  settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  review_closes_at TIMESTAMPTZ NOT NULL DEFAULT now() + public.deal_review_window(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT deals_one_per_source_ref UNIQUE (source, source_ref),
  CONSTRAINT deals_not_with_yourself CHECK (provider_actor_id <> customer_actor_id),
  CONSTRAINT deals_amount_has_currency CHECK ((amount IS NULL) = (currency IS NULL)),
  -- Written by this file's trigger and by service-role writers, never by a
  -- form, so this is a true invariant rather than an app enum.
  CONSTRAINT deals_status_check CHECK (status IN ('settled', 'completed', 'refunded', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_deals_provider
  ON public.deals (provider_actor_id, settled_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_customer
  ON public.deals (customer_actor_id, settled_at DESC);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Who dealt with whom is private to the two of them.
DROP POLICY IF EXISTS deals_select_parties ON public.deals;
CREATE POLICY deals_select_parties ON public.deals
  FOR SELECT USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      provider_actor_id IN (SELECT id FROM public.actors WHERE user_id = (SELECT auth.uid()))
      OR customer_actor_id IN (SELECT id FROM public.actors WHERE user_id = (SELECT auth.uid()))
    )
  );

-- No INSERT/UPDATE/DELETE policy: a person cannot declare a deal into being.

GRANT SELECT ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;

COMMENT ON TABLE public.deals IS
  'Observed deals between two actors, fleet-wide. The only thing a deal review can attach to. Private to its parties; public as aggregates via actor_track_record().';
COMMENT ON COLUMN public.deals.source IS
  'Where the deal happened, as product.kind (orangecat.order, evig.it_hilfe, loki.crew_assignment). List: src/config/reputation.ts.';
COMMENT ON COLUMN public.deals.review_closes_at IS
  'Last moment either side may review. After it, every review on the deal is public and no new one can be written.';

-- ==================== ORANGECAT ORDERS BECOME DEALS ====================

-- Which actor a user's deals are recorded against. Nothing makes a user's
-- actor unique (one account had six on 2026-09-18), so this is the same rule
-- as lookupUserActor in src/domain/actors: the OLDEST user actor wins, so a
-- person's track record never splits across duplicates.
CREATE OR REPLACE FUNCTION public.primary_user_actor(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.actors
   WHERE user_id = p_user_id AND actor_type = 'user'
   ORDER BY created_at ASC, id ASC
   LIMIT 1
$$;

-- An internal helper for the trigger below, not an API.
REVOKE EXECUTE ON FUNCTION public.primary_user_actor(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.primary_user_actor(UUID) TO service_role;

-- A deal starts when the money settles (orders.status = 'paid'), because that
-- is the moment OrangeCat has confirmed something real. Later order states are
-- followed. An order cancelled before payment never was a deal.
CREATE OR REPLACE FUNCTION public.order_becomes_a_deal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_provider UUID;
  v_customer UUID;
BEGIN
  v_status := CASE NEW.status
    WHEN 'paid' THEN 'settled'
    WHEN 'shipped' THEN 'settled'
    WHEN 'completed' THEN 'completed'
    WHEN 'refunded' THEN 'refunded'
    WHEN 'cancelled' THEN 'cancelled'
  END;
  IF v_status IS NULL THEN
    RETURN NEW;
  END IF;

  -- A deal must never cost a payment. Settlement updates orders after the
  -- money has moved; if anything here fails, the order update still stands
  -- and the deal is simply not recorded.
  BEGIN
    UPDATE public.deals
       SET status = v_status, updated_at = now()
     WHERE source = 'orangecat.order' AND source_ref = NEW.id::text;
    IF FOUND OR v_status = 'cancelled' THEN
      RETURN NEW;
    END IF;

    v_provider := public.primary_user_actor(NEW.seller_id);
    v_customer := public.primary_user_actor(NEW.buyer_id);
    IF v_provider IS NULL OR v_customer IS NULL OR v_provider = v_customer THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.deals (
      source, source_ref, provider_actor_id, customer_actor_id,
      entity_type, entity_id, title, amount, currency, status
    ) VALUES (
      'orangecat.order', NEW.id::text, v_provider, v_customer,
      NEW.entity_type, NEW.entity_id, COALESCE(NULLIF(NEW.entity_title, ''), 'Order'),
      NEW.amount_btc, 'BTC', v_status
    )
    ON CONFLICT (source, source_ref) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'order % did not become a deal: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_become_deals ON public.orders;
CREATE TRIGGER orders_become_deals
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.order_becomes_a_deal();

-- Orders already settled before this migration. Their buyers never had a
-- chance to review, so the window opens now rather than closing in the past.
INSERT INTO public.deals (
  source, source_ref, provider_actor_id, customer_actor_id,
  entity_type, entity_id, title, amount, currency, status,
  settled_at, review_closes_at
)
SELECT
  'orangecat.order', o.id::text, a.provider, a.customer,
  o.entity_type, o.entity_id, COALESCE(NULLIF(o.entity_title, ''), 'Order'),
  o.amount_btc, 'BTC',
  CASE o.status WHEN 'completed' THEN 'completed' WHEN 'refunded' THEN 'refunded' ELSE 'settled' END,
  COALESCE(o.updated_at, o.created_at, now()),
  now() + public.deal_review_window()
FROM public.orders o
CROSS JOIN LATERAL (
  SELECT public.primary_user_actor(o.seller_id) AS provider,
         public.primary_user_actor(o.buyer_id) AS customer
) a
WHERE o.status IN ('paid', 'shipped', 'completed', 'refunded')
  AND a.provider IS NOT NULL AND a.customer IS NOT NULL
  AND a.provider <> a.customer
ON CONFLICT (source, source_ref) DO NOTHING;

-- ==================== DEAL REVIEWS ====================

CREATE TABLE IF NOT EXISTS public.deal_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  reviewer_actor_id UUID NOT NULL REFERENCES public.actors(id) ON DELETE CASCADE,
  -- Both set from the deal by the trigger below; whatever a writer sends is
  -- overwritten, so no one can review a stranger or pick their own side.
  subject_actor_id UUID NOT NULL REFERENCES public.actors(id) ON DELETE CASCADE,
  reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('customer', 'provider')),
  -- question id -> yes/no. Which ids exist is src/config/reputation.ts.
  answers JSONB NOT NULL CHECK (
    jsonb_typeof(answers) = 'object'
    AND answers <> '{}'::jsonb
    AND NOT jsonb_path_exists(answers, '$.* ? (@.type() != "boolean")')
  ),
  body TEXT CHECK (body IS NULL OR char_length(body) BETWEEN 1 AND 5000),
  body_sha256 TEXT CHECK (body_sha256 IS NULL OR body_sha256 ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT deal_reviews_one_per_side UNIQUE (deal_id, reviewer_role),
  CONSTRAINT deal_reviews_body_has_hash CHECK ((body IS NULL) = (body_sha256 IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_deal_reviews_subject
  ON public.deal_reviews (subject_actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_reviews_reviewer
  ON public.deal_reviews (reviewer_actor_id, created_at DESC);

-- Place the review on its deal: the reviewer must be one of the two parties,
-- the window must be open, and the subject is the other party. Runs for
-- service-role writers too, which is the point — evig and Loki write here on
-- a person's behalf and get exactly the same rules.
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

  NEW.created_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deal_review_is_placed ON public.deal_reviews;
CREATE TRIGGER deal_review_is_placed
  BEFORE INSERT ON public.deal_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.deal_review_is_placed();

CREATE OR REPLACE FUNCTION public.deal_reviews_are_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'A review cannot be edited.'
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS deal_reviews_are_append_only ON public.deal_reviews;
CREATE TRIGGER deal_reviews_are_append_only
  BEFORE UPDATE ON public.deal_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.deal_reviews_are_append_only();

-- Revealed = both sides have written, or the window has closed. SECURITY
-- DEFINER because it counts reviews the caller cannot yet see; it returns one
-- boolean and nothing else.
CREATE OR REPLACE FUNCTION public.deal_reviews_revealed(p_deal_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
           SELECT 1 FROM public.deals d
            WHERE d.id = p_deal_id AND d.review_closes_at <= now()
         )
      OR (SELECT count(*) FROM public.deal_reviews r WHERE r.deal_id = p_deal_id) >= 2
$$;

ALTER TABLE public.deal_reviews ENABLE ROW LEVEL SECURITY;

-- Your own review, always. Anyone else's, once the deal is revealed.
DROP POLICY IF EXISTS deal_reviews_select ON public.deal_reviews;
CREATE POLICY deal_reviews_select ON public.deal_reviews
  FOR SELECT USING (
    public.deal_reviews_revealed(deal_id)
    OR (
      (SELECT auth.uid()) IS NOT NULL
      AND reviewer_actor_id IN (SELECT id FROM public.actors WHERE user_id = (SELECT auth.uid()))
    )
  );

-- As yourself. The trigger checks that you are a party and the window is open.
DROP POLICY IF EXISTS deal_reviews_insert ON public.deal_reviews;
CREATE POLICY deal_reviews_insert ON public.deal_reviews
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND reviewer_actor_id IN (SELECT id FROM public.actors WHERE user_id = (SELECT auth.uid()))
  );

-- No UPDATE policy (and the trigger above for writers that bypass RLS).
-- No DELETE policy: a review leaves the record only with its deal.

GRANT SELECT, INSERT ON public.deal_reviews TO authenticated;
GRANT SELECT ON public.deal_reviews TO anon;
GRANT ALL ON public.deal_reviews TO service_role;
GRANT EXECUTE ON FUNCTION public.deal_reviews_revealed(UUID) TO anon, authenticated, service_role;

COMMENT ON TABLE public.deal_reviews IS
  'Two-sided, blind, append-only reviews of a deal. Yes/no answers, no stars. Hidden until both sides have written or review_closes_at passes.';

-- ==================== THE PUBLIC TRACK RECORD ====================

-- What the platform observed about an actor, as counts. No deal, title,
-- amount or counterparty leaves this function. `distinct_customers` is there
-- because 40 deals with 40 people and 40 deals with one person are different
-- facts, and the second is what a self-dealing ring looks like.
CREATE OR REPLACE FUNCTION public.actor_track_record(p_actor_id UUID)
RETURNS TABLE (
  deals_provided INTEGER,
  deals_provided_completed INTEGER,
  deals_provided_refunded INTEGER,
  deals_provided_cancelled INTEGER,
  distinct_customers INTEGER,
  deals_as_customer INTEGER,
  btc_provided NUMERIC,
  first_deal_at TIMESTAMPTZ,
  last_deal_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*) FILTER (WHERE d.provider_actor_id = p_actor_id)::int,
    count(*) FILTER (WHERE d.provider_actor_id = p_actor_id AND d.status = 'completed')::int,
    count(*) FILTER (WHERE d.provider_actor_id = p_actor_id AND d.status = 'refunded')::int,
    count(*) FILTER (WHERE d.provider_actor_id = p_actor_id AND d.status = 'cancelled')::int,
    count(DISTINCT d.customer_actor_id) FILTER (WHERE d.provider_actor_id = p_actor_id)::int,
    count(*) FILTER (WHERE d.customer_actor_id = p_actor_id)::int,
    COALESCE(sum(d.amount) FILTER (
      WHERE d.provider_actor_id = p_actor_id AND d.currency = 'BTC'
        AND d.status IN ('settled', 'completed')
    ), 0),
    min(d.settled_at),
    max(d.settled_at)
  FROM public.deals d
  WHERE d.provider_actor_id = p_actor_id OR d.customer_actor_id = p_actor_id
$$;

GRANT EXECUTE ON FUNCTION public.actor_track_record(UUID) TO anon, authenticated, service_role;

-- Rollback (by hand, if ever needed):
--   DROP FUNCTION public.actor_track_record(UUID);
--   DROP TABLE public.deal_reviews;
--   DROP FUNCTION public.deal_reviews_revealed(UUID);
--   DROP FUNCTION public.deal_reviews_are_append_only();
--   DROP FUNCTION public.deal_review_is_placed();
--   DROP TRIGGER orders_become_deals ON public.orders;
--   DROP FUNCTION public.order_becomes_a_deal();
--   DROP FUNCTION public.primary_user_actor(UUID);
--   DROP TABLE public.deals;
--   DROP FUNCTION public.deal_review_window();

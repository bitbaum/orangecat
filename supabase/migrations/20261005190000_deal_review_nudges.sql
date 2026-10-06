-- Asking people to review their deals, once each. (ADR-0010)
--
-- Most people never review unless asked. The review-nudges cron asks each
-- side of a deal twice at most: a few days after it settles ('ask'), and
-- shortly before the window closes ('last_call'). This table is what makes
-- "at most" true. A nudge is recorded BEFORE it is sent, so a crash between
-- the two loses one nudge and never sends a second.
--
-- Written only by the service role (the cron). Nobody reads it but the cron.

CREATE TABLE IF NOT EXISTS public.deal_review_nudges (
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('customer', 'provider')),
  -- Which nudge. The list is REVIEW_NUDGES in src/config/reputation.ts.
  kind TEXT NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 40),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (deal_id, role, kind)
);

ALTER TABLE public.deal_review_nudges ENABLE ROW LEVEL SECURITY;
-- No policies: invisible to anon and authenticated.
GRANT ALL ON public.deal_review_nudges TO service_role;

COMMENT ON TABLE public.deal_review_nudges IS
  'One row per review nudge sent (deal, side, kind). Recorded before sending so a nudge is never sent twice.';

-- Rollback (by hand, if ever needed):
--   DROP TABLE public.deal_review_nudges;

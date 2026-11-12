-- A hard daily cap on what the PLATFORM's own key spends at one vendor.
--
-- The shared AI chain calls vendors on keys the platform pays for. On
-- 2026-11-12 the Gemini API was switched off to stop the spend, and every bot
-- on the shared pool stopped answering with it. The owner's rule: a vendor
-- may be on only with a strict spending cap. This is that cap.
--
-- One row per UTC day and vendor. reserve_vendor_call counts a call BEFORE it
-- is made and refuses once the day's cap is reached, atomically, so two
-- requests at the same moment cannot both take the last one. The app refuses
-- the call when the database cannot be asked (src/services/ai/vendor-spend-cap.ts):
-- an unknown count is never read as room.
--
-- A person's OWN key is never counted here: they pay for it themselves.
-- Rollback: DROP FUNCTION public.reserve_vendor_call(text, integer);
--           DROP TABLE public.platform_vendor_daily_calls;

CREATE TABLE IF NOT EXISTS public.platform_vendor_daily_calls (
  day DATE NOT NULL,
  vendor TEXT NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0 CHECK (calls >= 0),
  refused INTEGER NOT NULL DEFAULT 0 CHECK (refused >= 0),
  PRIMARY KEY (day, vendor)
);

ALTER TABLE public.platform_vendor_daily_calls ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role reads or writes it.
REVOKE ALL ON public.platform_vendor_daily_calls FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_vendor_call(p_vendor TEXT, p_cap INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day DATE := (NOW() AT TIME ZONE 'UTC')::date;
  v_taken BOOLEAN;
BEGIN
  IF p_cap IS NULL OR p_cap <= 0 THEN
    RETURN FALSE;
  END IF;
  INSERT INTO public.platform_vendor_daily_calls (day, vendor, calls)
  VALUES (v_day, p_vendor, 0)
  ON CONFLICT (day, vendor) DO NOTHING;

  UPDATE public.platform_vendor_daily_calls
     SET calls = calls + 1
   WHERE day = v_day AND vendor = p_vendor AND calls < p_cap
  RETURNING TRUE INTO v_taken;

  IF v_taken IS NULL THEN
    UPDATE public.platform_vendor_daily_calls
       SET refused = refused + 1
     WHERE day = v_day AND vendor = p_vendor;
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_vendor_call(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_vendor_call(TEXT, INTEGER) TO service_role;

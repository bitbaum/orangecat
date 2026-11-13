-- A QA run's listings are marked as test data.
--
-- "QA Grok A" (profile user_82732e99fdc2, made by a Grok-parity QA run on
-- 2026-11-10) owns products, services and a project that led Discover:
-- "Old Road Bike" was the first product a visitor saw, with "by QA Grok A"
-- on its share card (full-path review, 2026-11-13). 20261113121000 marked
-- three of its listings by id; this marks the rest the account owns, so the
-- public filter (is_test) keeps them off every shelf. Nothing is deleted.
--
-- Matched by id AND the profile's QA name, so a reused id cannot catch a
-- real person. Rows already marked are left as they are.
--
-- Rollback:
--   UPDATE public.user_products SET is_test = false WHERE user_id = '82732e99-fdc2-427a-9dbe-322bdfa0c819';
--   UPDATE public.user_services SET is_test = false WHERE user_id = '82732e99-fdc2-427a-9dbe-322bdfa0c819';
--   UPDATE public.projects      SET is_test = false WHERE user_id = '82732e99-fdc2-427a-9dbe-322bdfa0c819';
--   UPDATE public.user_causes   SET is_test = false WHERE user_id = '82732e99-fdc2-427a-9dbe-322bdfa0c819';

DO $$
DECLARE
  qa uuid;
BEGIN
  SELECT id INTO qa
    FROM public.profiles
   WHERE id = '82732e99-fdc2-427a-9dbe-322bdfa0c819'
     AND name = 'QA Grok A';
  IF qa IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.user_products SET is_test = true WHERE user_id = qa AND NOT is_test;
  UPDATE public.user_services SET is_test = true WHERE user_id = qa AND NOT is_test;
  UPDATE public.projects      SET is_test = true WHERE user_id = qa AND NOT is_test;
  UPDATE public.user_causes   SET is_test = true WHERE user_id = qa AND NOT is_test;
END $$;

-- Three QA listings made by hand on the live site are marked as test data.
--
-- "QA test product", "QA Test Project" and "QA Test Service" (created
-- 2026-11-10) were the first cards a visitor saw under "Just listed" on
-- /discover and led their own rails (UX/UI audit 2026-11-12, owner decision 3).
-- They carry neither `is_test` nor the "TEST " title prefix the public filter
-- looks for (src/config/public-directory.ts). Widening the title filter would
-- also hide real listings, so the three rows are marked by id instead.
--
-- Nothing is deleted. Rows already marked, or gone, are left as they are.
--
-- Rollback:
--   UPDATE public.user_products SET is_test = false WHERE id = '9b891cbf-dba5-4006-9383-b724e678954e';
--   UPDATE public.projects      SET is_test = false WHERE id = '1bcc8633-283a-4739-80c3-01559e479f40';
--   UPDATE public.user_services SET is_test = false WHERE id = '8cefa333-c863-4452-851a-16257061fb0a';

UPDATE public.user_products SET is_test = true
 WHERE id = '9b891cbf-dba5-4006-9383-b724e678954e' AND title = 'QA test product' AND NOT is_test;

UPDATE public.projects SET is_test = true
 WHERE id = '1bcc8633-283a-4739-80c3-01559e479f40' AND title = 'QA Test Project' AND NOT is_test;

UPDATE public.user_services SET is_test = true
 WHERE id = '8cefa333-c863-4452-851a-16257061fb0a' AND title = 'QA Test Service' AND NOT is_test;

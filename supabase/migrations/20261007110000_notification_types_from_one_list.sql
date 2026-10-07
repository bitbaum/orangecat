-- The notification types the database accepts = the app's one list
-- (src/config/notification-types.ts → IN_APP_NOTIFICATION_TYPES).
--
-- The CHECK last set in 20260729140000 lacked booking_request, booking_update
-- and deal_review, all dispatched by the app: every one of those in-app
-- notifications was rejected (the dispatcher logs and carries on), so booking
-- requests and deal-review reminders reached nobody's notifications. Adds
-- those three and the two event types (ticket, crew).
--
-- __tests__/unit/config/notification-types.test.ts compares the newest
-- migration's list with the config, so the two cannot drift again.

-- migration-safety: contract-ok widen-only CHECK swap — the new list is a
-- strict superset of the old one, so every insert the previous release makes
-- still passes; rollback-safe by construction.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY[
    'follow','payment','project_funded','message','comment','like','mention',
    'system','task_attention','task_request','task_completed','task_broadcast',
    'match','tip_dead_end','booking_request','booking_update','deal_review',
    'ticket','crew'
  ]::text[])
);

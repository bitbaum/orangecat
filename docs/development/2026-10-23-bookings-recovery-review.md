# Bookings recovery review

A production phone test injected a 503 bookings-list response. The page displayed “No bookings found” and had no Retry action. The history select had no associated label. Its computed font was already 16px through global field rules, despite a text-sm class. Source inspection also found the history status filter applied to incoming and confirmed records.

Bookings now distinguishes failed loading from an empty result, offers Retry, ignores stale responses and limits history filtering to History. A stable loader reads the currently selected view, including refresh after an action. View selection uses the existing shared SegmentedControl; history status has a visible label and shared field tokens. The page title matches the navigation noun, and Rejected is available in history filtering.

Two focused tests passed: HTTP failure recovers through Retry, and selecting a history status cannot hide incoming bookings. Source type-check passed before formatting-only lint fixes. A real 390px Chromium preview passed a failed load and Retry, named history status, selected-view state and no horizontal overflow. No booking was created or changed. Evidence: `/workspace/orangecat-review-evidence/bookings-repaired-phone.png`. Full `pnpm run verify` passed (1005.1 seconds), including tests, types, lint and repository guards. Deployment verification remains pending.

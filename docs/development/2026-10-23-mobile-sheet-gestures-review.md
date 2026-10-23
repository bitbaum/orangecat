# Mobile sheet gesture review

A real Chromium touch gesture on the deployed project picker reproduced dismissal while swiping its content. The shared BottomSheet attached drag handlers to the whole panel, so content scrolling could become a close gesture. Gesture coordinates also carried over between touches, and simultaneous sheets reused one heading ID.

Only the drag handle now starts dismissal. It has a 44px touch area; content keeps native scrolling. Each gesture resets its origin, cancellation restores the panel, and dismissal snaps back before calling the parent so a failed save can keep the sheet visible. Titled sheets use distinct React IDs.

Three focused tests passed for content versus handle gestures, repeated and cancelled touches, and simultaneous dialog names. The real 390px Chromium touch preview passed: a body swipe kept the picker open; a handle swipe closed only the picker and returned to the composer. Full `pnpm run verify` passed in 1260.4 seconds: 631 test files and 5,338 tests, with all type, lint, route and repository guards. This does not redesign the project picker or certify all shared-sheet consumers.

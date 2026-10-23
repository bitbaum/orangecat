# Confirmation dialog focus review

A controlled populated inbox on the deployed app opened a conversation by keyboard, wrapped a long heading and kept the composer above mobile navigation. The fixture intercepted all messaging writes, including its automatic read receipt; it did not test server delivery or contact another person.

Cancelling that row's delete confirmation lost keyboard focus even after the closing transition. The shared confirmation uses a controlled Radix dialog without a DialogTrigger, so its default close handler has no trigger reference to focus.

ConfirmDialog now records the actual focused opener before opening autofocus. On close it restores that connected opener, leaving the default behavior available when the opener has been removed. Existing focus trapping and confirmation actions remain unchanged.

Nine focused tests passed: Cancel, Escape and close-button return, plus the existing timeline deletion-dialog checks. Targeted lint passed. The real 390px phone preview passed Cancel returning focus to the delete button, keyboard entry into the controlled thread, composer clearance and no overflow. All messaging writes were intercepted. Full `pnpm run verify` passed in 1012.8 seconds: 631 test files and 5,338 tests, with all type, lint, route and repository guards.

Real message delivery, an actual phone keyboard, populated owner inboxes and successful deletion recovery remain unverified.

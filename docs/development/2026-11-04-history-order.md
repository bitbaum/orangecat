# Stable Cat turn history — 2026-11-04

The live failed-history verification on deployed `702d5593` restored recovery
controls and settled tools correctly, but placed the reply before its question.
The test screenshot is private evidence outside the repository.

Each paired insert receives one database timestamp. Both display and context
readers ordered only by that timestamp, fetched newest first, then reversed.
With tied timestamps, reversing could put assistant before user. Besides the UI
error, failed-context filtering then failed to remove the matching question.

Both readers now use role as the secondary order within a timestamp tie so the
chronological result is user then assistant. This handles existing stored pairs
without rewriting immutable migrations or manufacturing new message times.
Focused regressions exercise successful/failed display, successful context, and
exclusion of both halves of a failed exchange. Normal hooks, CI and a deployed
reload journey remain required; the floating launcher overlap is separate work.

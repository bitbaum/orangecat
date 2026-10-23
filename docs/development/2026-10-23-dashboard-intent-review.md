# Dashboard intent composer review

The dashboard's native GET field used shared tokens but bypassed the chatkit composer already used by Cat. It now renders that same application wrapper: server-backed dictation, keyboard behavior and resize behavior remain in the existing packages/adapters. Public TheDoor retains native GET submission before sign-in; it shares copy and length constraints with the dashboard.

Dashboard navigation encodes the request as one query value at the known Cat route. It retains the draft until unmount, blocks fewer than three or more than 500 trimmed characters without truncation, and does not focus the field on arrival. The shared wrapper maps chatkit action colors to application monochrome tokens.

Four focused tests passed, including existing resize regressions and actual package-composer navigation/retention checks. Type checking passed before the final token mapping. A real Chromium 390px preview passed no automatic focus, no horizontal overflow and encoded navigation; its destination response was intercepted, so this does not certify a model reply or returning-conversation handoff. Screenshot: `/workspace/orangecat-review-evidence/dashboard-chatkit-phone.png`. Full `pnpm run verify` passed (764.3 seconds), including tests, types, lint and repository guards. A deployed end-to-end model handoff remains to be checked.

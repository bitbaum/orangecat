# Messaging, form controls and session hydration — 22 October 2026

## Evidence

The supplied conversation-list and message-view screenshots are evidence of inconsistent spacing, duplicated controls and a large blank band below the composer. The live guest review also reproduced two behavioral failures: New Message had no dialog role and stayed open after Escape; delaying the auth callback POST sent a valid signed-in article session to sign-in after five seconds, then back to writing when released. The latter is a real cold-load race, not a cache explanation.

## Repairs

- New Message uses the existing Radix dialog, with a named search control, focus trapping, Escape, return focus, and a full phone frame. Search cancellation no longer lets an older request clear a newer loading state. Person rows are native buttons with one action.
- The inbox filter says Unread because it actually filters unread counts; it uses the shared segmented control. An empty unread filter does not claim there are no conversations. The shared input replaces the hand-styled search field.
- Conversation opening is keyboard-operable. Avatar/profile links and delete controls do not also open the conversation through event bubbling. Names wrap, previews use two lines, and separators use border tokens. The inbox and header share one display-name helper.
- Inbox matching uses `@bitbaum/searchkit`, with generated typo evaluation, against names and previews already loaded for the viewer. This does not claim to search all message history. New-message directory matching still uses the legacy profile endpoint; integrating the newer people finder needs exact-handle and explicit error behavior, which its money-specific hook currently omits.
- Listing inquiries share one response contract with New Message. Failures remain visible with Retry and Back to messages, retaining the destination. Leaving while opening cancels the pending navigation instead of redirecting late.
- The messaging frame owns mobile-navigation clearance once, using the shell token and the same soft-keyboard hook as the bottom bar. When typing hides the bar, its clearance is released too. AppShell delegates that space, and the composer no longer adds a hardcoded four-rem blank band on both phone and desktop. Long participant headers can shrink inside the frame.
- Shared textareas enforce native `required`, rather than only drawing an asterisk. Shared inputs and textareas use 16px phone text and appropriate control heights. The Cat intent form uses shared field tokens and Button; it retains native GET submission and is not mislabeled as search.
- AuthProvider accepts Supabase's session event without waiting on a redundant server-sync POST. The existing cookie adapter already persists sessions for browser and server. Sign-out clears visible state immediately while offline-queue cleanup runs in the background; cross-tab sign-out also clears that tab's queue.
- A real project-wizard tap exposed the bottom bar returning between pointerdown and click after a field blurred. The shared soft-keyboard hook now holds chrome hidden through the tap. Chromium confirmed that Next submits and advances to Funding; timing tests also cover keyboard-only blur.
- The release workflow matrix starts with empty browser storage because its flows explicitly sign in. Reusing global setup's signed-in session redirected away from the login form during fast hydration. The signed-out dashboard case now requires an actual sign-in redirect.

## Checks and limits

Focused regression tests cover dialog naming/focus/Escape/reopening, separate row actions, typo matching and visible previews, inquiry failure/retry/cancellation, native textarea validation, route chrome, immediate session hydration and pending sign-out cleanup. Chromium exercised the repaired inbox and dialog at 390px. A populated-thread layout uses synthetic intercepted responses, not the owner's private messages. Backend participant checks, posting and actor contracts remain unchanged. Full repository verification and CI are required before shipping.

The owner account was not accessed. No messages were sent to other people, articles published, payments initiated, or existing records deleted. The broader route ledger distinguishes first-viewport capture from completed source and interaction review. The custom direct-message composer still needs a separate migration to the existing chatkit package; generic composer behavior should be fixed there, not copied locally.

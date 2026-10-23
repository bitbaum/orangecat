# Short-post draft safety review

The deployed phone composer lost newly typed text when closed before its debounce elapsed. The browser reproduction made no post requests. Its old device-wide key also mixed accounts and reply contexts, expired writing after 24 hours, and silently swallowed storage failures.

Drafts now use an account and conversation-context key, flush on close, unmount and page hide, and preserve cleared text. Storage errors remain visible with Retry save; a failed close keeps the composer open. Failed writes remain available in the same tab. Unreadable owned storage is backed up before replacement.

Older unowned drafts require an explicit ownership checkbox before recovery. Recovery adds their text to current writing as Only me and resets project destinations. Copying succeeds before the old source is removed, and a marker prevents duplicate recovery when removal fails. Incoming share text with drafts disabled remains intact.

Focused verification: 14 hook tests passed, covering immediate close, page hide, account/reply separation, expired writing, explicit recovery, failed writes and recovery, cleared text, unreadable storage and disabled drafts. Type check, targeted lint and file-size guards passed. The real phone browser preview passed immediate close/reopen, cleared text, failed save retaining the editor, Retry save and consented private recovery. No timeline/post POST requests were made. Full `pnpm run verify` passed in 1192.1 seconds: 626 test files and 5,303 tests, plus all type, lint, route and repository guards.

Scope: this repairs text draft persistence. It does not certify attachment persistence, populated project selection, every reply UI or the remaining duplicate composer interfaces.

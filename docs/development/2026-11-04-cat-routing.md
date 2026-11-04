# Cat live catalogue routing repair — 2026-11-04

A real contextual Heidi question failed after 29.6 seconds with AI_RATE_LIMITED.
Read-only server diagnostics run `41843315466` found one HTTP 429, one HTTP 404
and two unclassified errors along the chain. The public vendor catalogue listed
only one of the two enabled registry free entries, alongside live free models
supporting tools. The complete provider failure is not yet resolved.

Two source defects make a retired entry reachable despite existing discovery:

- The first chat after a cold start built the chain before discovery finished.
- When all registry entries retired, the code restored them ahead of discovered
  alternatives instead of using those live alternatives alone.

A person sending a chat now awaits the existing cached catalogue resolution
before the platform chain is built. The package's catalogue timeout is two
seconds; unreadable catalogues preserve the existing fallback. Cached results
are reused for the existing one-hour lifetime. This is a catalogue lookup, not
an AI completion or embedding, and it does not run on a timer. Discovery still
requires zero published price, text output and tools. Personal-key and evaluation
routing remain intact. A resolved catalogue is not proof of available quota.

Focused tests passed (14): retired entries removed even when all registry entries
retire, first chat awaits discovery, later chats reuse the cache, catalogue
failure retains the fallback, and provider resolution waits before snapshotting
the chain. Normal hooks and CI remain required on final source; deployment and
real short/contextual questions must be verified before closing this repair.

Continue from the fleet repair ledger and the separate temporary-chat consent PR.
No model identifiers were newly added to the registry by this repair. Do not use
an owner-provided API key to claim the shared free pool works. Do not silently
route free traffic onto a paid vendor.

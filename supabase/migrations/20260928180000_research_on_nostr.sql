-- Research published to Nostr, signed by the researcher's own key.
--
-- OrangeCat is one server. A pre-registration kept only here is only as
-- durable as this server and only as trustworthy as its operator. Publishing
-- the commitment as a signed Nostr event puts it on relays nobody here
-- controls, under a key only the researcher holds (NIP-07: the browser
-- extension signs; OrangeCat never sees the secret key). The server records
-- where it went only after checking the signature and that the event is about
-- THIS research.
--
--   nostr_event_id  the signed event's id (hex); a later republish replaces it,
--                   because the event is addressable (kind 30023, d = research id)
--   nostr_pubkey    the researcher's public key (hex) — their pseudonymous
--                   identity on Nostr, independent of their OrangeCat account

ALTER TABLE public.research_entities
  ADD COLUMN IF NOT EXISTS nostr_event_id TEXT,
  ADD COLUMN IF NOT EXISTS nostr_pubkey TEXT,
  ADD COLUMN IF NOT EXISTS nostr_published_at TIMESTAMPTZ;

ALTER TABLE public.research_entities
  ADD CONSTRAINT research_entities_nostr_hex
    CHECK (
      (nostr_event_id IS NULL OR nostr_event_id ~ '^[0-9a-f]{64}$')
      AND (nostr_pubkey IS NULL OR nostr_pubkey ~ '^[0-9a-f]{64}$')
    ),
  ADD CONSTRAINT research_entities_nostr_complete
    CHECK (
      (nostr_event_id IS NULL AND nostr_pubkey IS NULL AND nostr_published_at IS NULL)
      OR (nostr_event_id IS NOT NULL AND nostr_pubkey IS NOT NULL AND nostr_published_at IS NOT NULL)
    );

-- Rollback (by hand, if ever needed):
--   ALTER TABLE public.research_entities DROP COLUMN nostr_event_id,
--     DROP COLUMN nostr_pubkey, DROP COLUMN nostr_published_at;

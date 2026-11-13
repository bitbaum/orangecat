-- A group chat wore the faces of its first two members and nothing else.
-- avatar_url, when set, is the face its owner picked for it (one of our own
-- shapes and colours, written by the server from the two ids, never a URL
-- the client sent). NULL keeps the members' faces, which is also what
-- "use the members' faces" writes back.

ALTER TABLE public.companion_rooms
  ADD COLUMN IF NOT EXISTS avatar_url TEXT
  CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 200);

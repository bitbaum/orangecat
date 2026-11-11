/**
 * A temporary chat: the conversation exists only while the person is in it.
 *
 * chatkit's ChatApp draws it (Temporary chat in the header's "…") and never
 * writes it to the chat list. On the server its turns run in an unlisted row
 * (`cat_conversations.ephemeral`, never listed, never read into memory) that
 * useCatTransport deletes the moment the person leaves it. The daily cleanup
 * cron deletes any left over after a day, so a dead phone does not keep one.
 */

/** How long a left-over temporary chat survives before the sweep takes it. */
export const TEMPORARY_CHAT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

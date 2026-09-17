# Messaging System Notes

created_date: 2025-12-08  
last_modified_date: 2025-12-11  
last_modified_summary: Link avatars/names in DM list and header to profiles

- Conversations now load via `get_user_conversations` RPC to avoid duplicate rows from older views.
- Detail view fallback uses `conversation_details` with a safe `maybeSingle` to prevent "Conversation not found" when multiple rows existed.
- New migration `20251208_grant_messaging_permissions.sql` grants authenticated users access to messaging views/functions.
- Removed console logging in the new conversation modal to keep production logs clean.
- Validate after deploy: open `/messages`, start a new conversation, and send/receive replies between two users.
- Next.js 15+ requires awaiting route `params`; `messages/[conversationId]` handlers now await `params` to avoid runtime errors.
- Dev-only auto-migration call to `/api/admin/apply-messaging-migrations` now records failed attempts to prevent repeated 500s when `SUPABASE_ACCESS_TOKEN` is missing; run the migrations manually when credentials are unavailable.
- Auth state changes post to `/api/auth/callback` and also prime the current session on mount so Supabase cookies stay in sync and `/api/messages` handlers don’t return 401 on first load.
- Conversation fetch now trusts `get_user_conversations` scoping for auth, and if that fails, falls back to any participant row (even inactive) plus a minimal conversation fetch to avoid false 403s that were triggering the new-conversation modal.
- `/api/profiles` now returns a standard paginated array shape (with `metadata` for page/limit/total) so the new-conversation picker renders user rows and search results correctly.
- Messages UI now mirrors the split-view DM layout (tabs, refined search, softer empty state with primary CTA) to make starting or finding chats easier.
- Conversation list rows are tightened to the X/Twitter DM look; long-press to enter selection mode on touch, drag across rows (mouse or touch) to select/deselect quickly, and unread chips surface request-like items when the Requests tab is active.
- Message bubbles now show WhatsApp-style delivery/read ticks: single gray = sent, double gray = delivered to someone, double colored = read by all recipients; pending/failed still show inline.
- Bulk delete flows now confirm when removing multiple items and surface success/error toasts for conversations and in-thread message deletes.

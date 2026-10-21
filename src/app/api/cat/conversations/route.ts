/**
 * Cat Conversations API
 *
 * GET    /api/cat/conversations           - List the user's conversations (rail)
 * POST   /api/cat/conversations           - Start a new conversation, returns { id }
 *                                            ({ ephemeral: true } for a temporary chat)
 * DELETE /api/cat/conversations?all=true  - Delete ALL conversations (data controls)
 */

import {
  listConversations,
  createConversation,
  deleteAllConversations,
} from '@/services/cat/conversation-history';
import { apiSuccess, apiError, apiRateLimited, handleApiError } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const conversations = await listConversations(supabase, user.id);
    return apiSuccess({ conversations });
  } catch (error) {
    return handleApiError(error);
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;

  const rl = await rateLimitWriteAsync(user.id);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }

  try {
    // The body is optional: a bare POST is an ordinary chat. `ephemeral`
    // makes a temporary one (src/lib/chat/temporary-chat.ts).
    const body = (await request.json().catch(() => null)) as { ephemeral?: unknown } | null;
    const id = await createConversation(supabase, user.id, null, {
      ephemeral: body?.ephemeral === true,
    });
    return apiSuccess({ id });
  } catch (error) {
    return handleApiError(error);
  }
});

export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;

  // Bulk-delete is explicit-opt-in via ?all=true — a bare DELETE on the
  // collection must not wipe everything by accident. Single-conversation
  // delete lives at /api/cat/conversations/[id].
  if (request.nextUrl.searchParams.get('all') !== 'true') {
    return apiError('Pass ?all=true to delete all conversations', 'VALIDATION_ERROR', 400);
  }

  const rl = await rateLimitWriteAsync(user.id);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }

  try {
    const ok = await deleteAllConversations(supabase, user.id);
    if (!ok) {
      return apiError('Failed to delete conversations', 'INTERNAL_ERROR', 500);
    }
    return apiSuccess({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
});

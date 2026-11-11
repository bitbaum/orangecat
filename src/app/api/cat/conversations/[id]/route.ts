/**
 * Cat Conversation (by id) API
 *
 * GET    /api/cat/conversations/[id]  - Messages for one conversation (404 when not yours)
 * PATCH  /api/cat/conversations/[id]  - Rename it: { title }
 * DELETE /api/cat/conversations/[id]  - Delete the conversation and its messages
 */

import {
  getMessagesForDisplay,
  deleteConversation,
  renameConversation,
  resolveOwnedConversationId,
} from '@/services/cat/conversation-history';
import {
  apiSuccess,
  apiBadRequest,
  apiRateLimited,
  apiNotFound,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { validateUUID, getValidationError } from '@/lib/api/validation';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const GET = withAuth(async (request: AuthenticatedRequest, context: RouteParams) => {
  const { id } = await context.params;
  const invalid = getValidationError(validateUUID(id, 'conversation ID'));
  if (invalid) {
    return invalid;
  }

  const { user, supabase } = request;
  try {
    // A chat that is gone (or never this person's) is a 404, never the
    // default conversation in its place: the chat list drops the row.
    if (!(await resolveOwnedConversationId(supabase, user.id, id))) {
      return apiNotFound('Conversation not found');
    }
    const messages = await getMessagesForDisplay(supabase, user.id, id);
    return apiSuccess(messages);
  } catch (error) {
    return handleApiError(error);
  }
});

export const PATCH = withAuth(async (request: AuthenticatedRequest, context: RouteParams) => {
  const { id } = await context.params;
  const invalid = getValidationError(validateUUID(id, 'conversation ID'));
  if (invalid) {
    return invalid;
  }

  const { user, supabase } = request;

  const rl = await rateLimitWriteAsync(user.id);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }

  const body = (await request.json().catch(() => null)) as { title?: unknown } | null;
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return apiBadRequest('A title is required');
  }

  try {
    const ok = await renameConversation(supabase, user.id, id, title);
    if (!ok) {
      return apiNotFound('Conversation not found');
    }
    return apiSuccess({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
});

export const DELETE = withAuth(async (request: AuthenticatedRequest, context: RouteParams) => {
  const { id } = await context.params;
  const invalid = getValidationError(validateUUID(id, 'conversation ID'));
  if (invalid) {
    return invalid;
  }

  const { user, supabase } = request;

  const rl = await rateLimitWriteAsync(user.id);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }

  try {
    const ok = await deleteConversation(supabase, user.id, id);
    if (!ok) {
      return apiNotFound('Conversation not found');
    }
    return apiSuccess({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
});

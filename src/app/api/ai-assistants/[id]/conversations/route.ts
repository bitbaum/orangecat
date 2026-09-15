/**
 * AI Assistant Conversations API
 *
 * GET /api/ai-assistants/[id]/conversations - List user's conversations with this assistant
 * POST /api/ai-assistants/[id]/conversations - Create a new conversation
 *
 * Last Modified: 2026-01-28
 * Last Modified Summary: Refactored to use withAuth middleware
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { logger } from '@/utils/logger';
import { decideConversationAccess } from '@/services/companions/access';
import {
  apiSuccess,
  apiCreated,
  apiBadRequest,
  apiNotFound,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { validateUUID, getValidationError } from '@/lib/api/validation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id: assistantId } = await context.params;
  const idValidation = getValidationError(validateUUID(assistantId, 'assistant ID'));
  if (idValidation) {
    return idValidation;
  }
  try {
    const { user, supabase } = request;

    // Verify assistant exists
    const { data: assistant, error: assistantError } = await supabase
      .from(DATABASE_TABLES.AI_ASSISTANTS)
      .select('id, title, status')
      .eq('id', assistantId)
      .single();

    if (assistantError || !assistant) {
      return apiNotFound('Assistant not found');
    }

    // Get user's conversations with this assistant
    const { data: conversations, error } = await supabase
      .from(DATABASE_TABLES.AI_CONVERSATIONS)
      .select('*')
      .eq('assistant_id', assistantId)
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) {
      logger.error('Error fetching conversations', error, 'AIConversationsAPI');
      return apiInternalError('Failed to fetch conversations');
    }

    return apiSuccess(conversations || []);
  } catch (error) {
    logger.error('Conversations API error', error, 'AIConversationsAPI');
    return apiInternalError('Internal server error');
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id: assistantId } = await context.params;
  const idValidation = getValidationError(validateUUID(assistantId, 'assistant ID'));
  if (idValidation) {
    return idValidation;
  }
  try {
    const { user, supabase } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      const retryAfter = retryAfterSeconds(rl);
      return apiRateLimited('Too many conversation requests. Please slow down.', retryAfter);
    }

    // Verify assistant exists and is active
    const { data: assistant, error: assistantError } = await supabase
      .from(DATABASE_TABLES.AI_ASSISTANTS)
      .select('id, title, status, is_public, user_id, welcome_message')
      .eq('id', assistantId)
      .single();

    if (assistantError || !assistant) {
      return apiNotFound('Assistant not found');
    }

    const access = decideConversationAccess(assistant, user.id);
    if (!access.allowed) {
      return access.reason === 'not_found'
        ? apiNotFound('Companion not found')
        : apiBadRequest('This companion is not active');
    }

    // Create new conversation
    const { data: conversation, error: createError } = await supabase
      .from(DATABASE_TABLES.AI_CONVERSATIONS)
      .insert({
        assistant_id: assistantId,
        user_id: user.id,
        status: STATUS.AI_CONVERSATIONS.ACTIVE,
      })
      .select()
      .single();

    if (createError) {
      logger.error('Error creating conversation', createError, 'AIConversationsAPI');
      return apiInternalError('Failed to create conversation');
    }

    // The prompt is composed per turn (definition + memory), never stored as a row.

    // Add welcome message if exists
    if (assistant.welcome_message) {
      await supabase.from(DATABASE_TABLES.AI_MESSAGES).insert({
        conversation_id: conversation.id,
        role: 'assistant',
        content: assistant.welcome_message,
      });
    }

    return apiCreated(conversation);
  } catch (error) {
    logger.error('Create conversation error', error, 'AIConversationsAPI');
    return apiInternalError('Internal server error');
  }
});

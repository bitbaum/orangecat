/**
 * POST /api/cat/prepare — Cat's brain for LOCAL inference.
 *
 * Returns the fully-assembled message array (context + memories + custom
 * instructions + page excerpt + history + the new user message) so the
 * browser can run the completion on a model on the USER's machine (Ollama /
 * LM Studio). Inference never touches our server or any provider; this
 * endpoint only prepares the prompt. The finished exchange is persisted via
 * /api/cat/local-complete.
 *
 * No platform quota is consumed and nothing is metered — local inference is
 * the user's own hardware.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';
import { apiBadRequest, apiInternalError, apiSuccess } from '@/lib/api/standardResponse';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { createRateLimitResponse, rateLimitWriteAsync } from '@/lib/rate-limit';
import { prepareCatChat } from '@/services/cat/chat-prepare';
import { catChatBodySchema } from '@/services/cat/chat-orchestrator';

// Same client hints as the chat route, minus server-model concerns.
const prepareSchema = catChatBodySchema.omit({ model: true, stream: true });

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return createRateLimitResponse(rl) as NextResponse;
    }

    const body = await (request as NextRequest).json();
    const parsed = prepareSchema.safeParse(body);
    if (!parsed.success) {
      return apiBadRequest('Invalid request', parsed.error.flatten());
    }
    const { message, conversationId, ...hints } = parsed.data;

    // actionsVia: 'none' — ADR-0006 D8, and it is a statement of fact, not a
    // policy choice. This route hands the prompt to a model running in the
    // user's OWN browser (Ollama / LM Studio), and the only thing that comes
    // back is POST /api/cat/local-complete, which saves messages. There is no
    // executor on this path: an exec_action block reaches the transcript as
    // literal text and is stored verbatim, so the user reads "Creating that
    // now…" for something nothing will ever create.
    //
    // Until a local model's output is routed through CatActionExecutor, the
    // honest prompt is the one that says Cat cannot act here.
    const prepared = await prepareCatChat(supabase, user.id, {
      message,
      requestedConversationId: conversationId,
      ...hints,
      actionsVia: 'none',
    });

    return apiSuccess({
      messages: prepared.messages,
      conversationId: prepared.conversationId,
    });
  } catch (error) {
    logger.error('Cat prepare failed', { error }, 'cat/prepare');
    return apiInternalError('Could not prepare the conversation');
  }
});

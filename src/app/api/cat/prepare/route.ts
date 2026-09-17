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

    // actionsVia: 'prose' — ADR-0008 D2. This was 'none' for as long as the
    // claim was true: /api/cat/local-complete only saved messages, so an
    // exec_action block reached the transcript as literal text and the user
    // read "Creating that now…" for something nothing would ever create.
    // ADR-0006 D8 made the prompt honest about that. D2 made it false instead,
    // which is the better fix — local-complete now parses the envelope and
    // runs it through CatActionExecutor, with every permission check, spend
    // cap, confirmation and audit row the hosted path has.
    //
    // 'prose' and not 'tools' because this model is in the user's browser. The
    // server never makes the inference call, so there is no round trip in
    // which to send tool definitions; the text envelope IS the protocol here,
    // and dropping the catalogue for definitions nobody can send would leave
    // Cat with no verb at all (see actionsViaForModel).
    const prepared = await prepareCatChat(supabase, user.id, {
      message,
      requestedConversationId: conversationId,
      ...hints,
      actionsVia: 'prose',
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

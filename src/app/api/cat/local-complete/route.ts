/**
 * POST /api/cat/local-complete — take an exchange answered by a LOCAL model
 * (Ollama / LM Studio in the user's browser), run whatever it asked for, and
 * persist the result.
 *
 * The inference happened on the user's machine; nothing is metered and no
 * quota is debited. What happens HERE is the half that cannot live in a
 * browser: the permission checks, the spend caps, the confirmation flow and
 * the audit log. The browser holds the model, the server holds the rules.
 *
 * ADR-0008 D2. Before this, the route was 52 lines that only called
 * `saveMessages`, so a local model's Cat could not do anything — and worse,
 * an exec_action block reached the transcript as literal text, so the user
 * read "Creating that now…" for something nothing would ever create.
 * ADR-0006 D8 made that honest by telling a local model it could not act; this
 * makes it untrue, which is the better fix.
 *
 * The loop is client-driven — the browser runs the model, posts the reply,
 * gets the outcomes back, and runs the model again so it can write its final
 * answer knowing what actually happened. That is only safe because the client
 * gains no privilege by driving it: every action is executed for the
 * AUTHENTICATED user's own actor, through the same executor as the hosted
 * path, so a forged block can do nothing the user could not already do by
 * calling the API directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/utils/logger';
import { apiBadRequest, apiInternalError, apiSuccess } from '@/lib/api/standardResponse';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { createRateLimitResponse, rateLimitWriteAsync } from '@/lib/rate-limit';
import { saveMessages } from '@/services/cat/conversation-history';
import { parseActionsFromResponse } from '@/services/cat/response-parser';
import { runExecActions } from '@/services/cat/exec-actions';
import { getUserActorId } from '@/domain/actors';
import { AI_MESSAGE_MAX_CHARS } from '@/lib/validation/ai';

const completeSchema = z.object({
  conversationId: z.string().guid(),
  message: z.string().min(1).max(AI_MESSAGE_MAX_CHARS),
  reply: z.string().min(1).max(100_000),
  /** `local:<runtime>:<model>` id the client actually used. */
  model: z.string().min(1).max(200),
  /**
   * True while the browser is still looping — the model has asked for actions
   * and will be run again with the results, so this reply is a step and not an
   * answer. A step is executed but NOT written to history: the transcript
   * should carry the final answer, not the model thinking out loud.
   */
  intermediate: z.boolean().optional(),
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return createRateLimitResponse(rl) as NextResponse;
    }

    const body = await (request as NextRequest).json();
    const parsed = completeSchema.safeParse(body);
    if (!parsed.success) {
      return apiBadRequest('Invalid request', parsed.error.flatten());
    }
    const { conversationId, message, reply, model, intermediate } = parsed.data;

    // The envelope must come OUT of the text before anything is stored or
    // shown. Storing the raw reply is what made a local Cat announce work it
    // had not done — the block itself was the "announcement".
    const { message: cleanedMessage, actions, quickReplies } = parseActionsFromResponse(reply);

    const actorId = await getUserActorId(supabase, user.id);
    const execResults = await runExecActions(supabase, user.id, actorId, actions);

    // A step in the loop is not a transcript entry. Only the final reply is.
    if (!intermediate) {
      await saveMessages(supabase, conversationId, user.id, [
        { role: 'user', content: message },
        { role: 'assistant', content: cleanedMessage, model_used: model, provider: 'local' },
      ]);
    }

    return apiSuccess({
      saved: !intermediate,
      message: cleanedMessage,
      actions: actions.length > 0 ? actions : undefined,
      execResults: execResults.length > 0 ? execResults : undefined,
      quickReplies,
    });
  } catch (error) {
    logger.error('Cat local-complete failed', { error }, 'cat/local-complete');
    return apiInternalError('Could not save the local exchange');
  }
});

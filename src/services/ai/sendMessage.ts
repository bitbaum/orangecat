/**
 * AI Message Send Service
 *
 * Core business logic for the AI conversation message flow:
 * validate access → select model → call AI → store messages → charge/track.
 * Extracted from /api/ai-assistants/[id]/conversations/[convId]/messages.
 *
 * This file is the thin orchestrator (sendAiMessage); the pipeline steps live in
 * sendMessage-internals.ts and the shared types in sendMessage-types.ts.
 */

import type { ChatImage } from '@/services/cat/chat-images';
import { storeChatImages } from '@/services/cat/chat-image-store';
import { withImageRefs } from '@/lib/chat/attachment-tags';
import { fromTable } from '@/lib/supabase/untyped';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { createApiKeyService } from './api-key-service';
import { readOwnKey } from './own-key';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  computeCreatorChargeBtc,
  checkAffordability,
  settleAssistantCharge,
} from '@/services/ai/assistant-charge';
import type { SendMessageResult, SendMessageError } from './sendMessage-types';
import { recallCompanionMemories, extractCompanionMemories } from '@/services/companions/memory';
import { buildCompanionSystemPrompt } from '@/services/companions/system-prompt';
import { adoptJob, isJobAnswer } from '@/services/companions/born';
import {
  proposalFromMetadata,
  stepResultMessage,
  withProposal,
  type Proposal,
} from '@/services/companions/hands';
import { getUserActorId } from '@/domain/actors';
import { mayTakeStep, noteHeldStep, runAutoStep } from '@/services/companions/work-loop';
import {
  REVIEW_SYSTEM,
  getBotSettings,
  heldLine,
  needsReview,
  readVerdict,
  reviewQuestion,
  rulesSection,
} from '@/services/companions/rules';
import {
  handsFor,
  proposeFromReply,
  queueProposalAsCard,
} from '@/services/companions/hands-server';
import { logger } from '@/utils/logger';
import { turnTimer } from './turn-timer';
import {
  verifyConversation,
  fetchAssistant,
  checkFreeMessageUsage,
  generateReply,
  storeUserMessage,
  storeAssistantMessage,
} from './sendMessage-internals';

type HistoryRow = { role: string; content: string; metadata?: unknown };

/** Lines of a thread the model is shown each turn. */
export const HISTORY_LINES = 20;

/** Rows read newest first, put back in the order they were said. */
export function latestFirstToChronological<T>(rows: readonly T[]): T[] {
  return [...rows].reverse();
}

export type { SendMessageResult, SendMessageError } from './sendMessage-types';

export async function sendAiMessage(
  supabase: SupabaseClient,
  userId: string,
  assistantId: string,
  convId: string,
  content: string,
  requestedModel?: string,
  /** Photos on this turn (the message carries their tags; see chat-images.ts). */
  images?: ChatImage[]
): Promise<SendMessageResult | SendMessageError> {
  const timer = turnTimer();
  // 1. Verify conversation
  const convResult = await verifyConversation(supabase, convId, assistantId, userId);
  if ('error' in convResult) {
    return convResult.error;
  }

  // 2. Fetch assistant
  const assistantResult = await fetchAssistant(supabase, assistantId);
  if ('error' in assistantResult) {
    return assistantResult.error;
  }
  const assistant = assistantResult.assistant;

  // 3. Determine provider + BYOK
  const keyService = createApiKeyService(supabase);
  // The person's own key, whichever provider it is from (own-key.ts): asked
  // first, so their bots answer whatever the shared pool does.
  const { hasByok, userKey: userOpenRouterKey, directKey } = await readOwnKey(keyService, userId);

  // 4. Check platform usage limits (non-BYOK users)
  if (!hasByok) {
    const platformUsage = await keyService.checkPlatformUsage(userId);
    if (!platformUsage.can_use_platform) {
      return {
        code: 'RATE_LIMITED',
        message: 'Daily limit reached. Add your own OpenRouter API key for unlimited usage.',
      };
    }
  }

  // 5. Get conversation history: the LATEST lines, oldest first. Read
  //    ascending with a limit, a thread longer than the limit showed the
  //    model its first lines forever and never the newest ones (a bot's own
  //    steps and routines add lines fast).
  const { data: historyData } = await supabase
    .from(DATABASE_TABLES.AI_MESSAGES)
    .select('role, content, metadata')
    .eq('conversation_id', convId)
    // Legacy threads stored the prompt as a system row; the prompt is composed
    // per turn now (with memory), so a stored copy would only go stale.
    .neq('role', 'system')
    .order('created_at', { ascending: false })
    .limit(HISTORY_LINES);
  // A stored turn is the words the person saw; the model is shown the fence
  // it wrote too, or it learns from its own history to stop proposing.
  const history = latestFirstToChronological((historyData || []) as HistoryRow[]).map(row => {
    const proposal = row.role === 'assistant' ? proposalFromMetadata(row.metadata) : null;
    return {
      role: row.role,
      content: proposal ? withProposal(row.content, proposal) : row.content,
    };
  });

  // 6. Free message check
  const freeMessagesPerDay = assistant.free_messages_per_day || 0;
  const { usesFreeMessage, freeMessagesRemaining } = await checkFreeMessageUsage(
    supabase,
    userId,
    assistantId,
    freeMessagesPerDay
  );

  // 8. Compute the creator's per-message charge (BTC) and pre-authorize it against the
  //    user's Cat Credits balance BEFORE calling the model, so we can return a clean
  //    INSUFFICIENT_CREDITS without serving a message. Free messages / non-per_message
  //    pricing cost nothing (see assistant-charge.ts).
  const creatorCharge = computeCreatorChargeBtc(assistant, usesFreeMessage);
  const admin = creatorCharge > 0 ? getAdminClient() : null;
  if (admin && creatorCharge > 0) {
    const affordability = await checkAffordability(admin, userId, creatorCharge);
    if (!affordability.ok) {
      return {
        code: 'INSUFFICIENT_CREDITS',
        currentBalance: affordability.balance,
        requiredAmount: creatorCharge,
        shortfall: creatorCharge - affordability.balance,
      };
    }
  }

  // 9. Store user message, with each photo's private path in its tag so a
  //    reload shows what was sent and a later turn can read it again.
  const refs = images?.length ? await storeChatImages(userId, images) : [];
  const userMsgResult = await storeUserMessage(
    supabase,
    convId,
    withImageRefs(
      content,
      refs.filter((r): r is string => Boolean(r))
    )
  );
  if ('error' in userMsgResult) {
    return userMsgResult.error;
  }
  const userMessage = userMsgResult.message;

  // 10. Generate AI response. The prompt is the creator's definition plus what
  //     this companion remembers about THIS person — nothing else.
  const memoryKey = { assistantId, userId };
  timer.mark('checks');
  // Memory and hands do not depend on each other: both are read at once.
  // Hands: the owner's own companion may propose what OrangeCat can do for
  // them (hands.ts); anyone else's companion, or a stranger's chat, cannot.
  const isOwner = assistant.user_id === userId;
  const [recalled, hands, botSettings] = await Promise.all([
    recallCompanionMemories(supabase, memoryKey, content),
    isOwner ? handsFor(supabase, userId, assistantId) : Promise.resolve(null),
    // The owner's own rules and time zone, for the owner's own bot only.
    isOwner ? getBotSettings(supabase, userId) : Promise.resolve(null),
  ]);
  timer.mark('context');
  const systemPrompt = buildCompanionSystemPrompt({
    definition: assistant.system_prompt,
    memories: recalled.map(m => m.content),
    hands: hands?.section,
    rules: botSettings ? rulesSection(botSettings) : undefined,
  });
  const aiResult = await generateReply({
    hasByok,
    userKey: userOpenRouterKey,
    directKey,
    requestedModel,
    assistant,
    systemPrompt: systemPrompt ?? null,
    history,
    content,
    images,
    ownerTurn: assistant.user_id === userId,
  });
  // The reply is not streamed, so the model's whole answer is the wait for
  // its first word: this is the time to first token the person feels.
  timer.mark('model');
  if ('error' in aiResult) {
    // Clean up user message on AI failure
    await supabase
      .from(DATABASE_TABLES.AI_MESSAGES)
      .delete()
      .eq('id', (userMessage as { id: string }).id);
    return aiResult.error;
  }
  // A proposal rides the end of the reply as a fence; it comes off before
  // the words are stored, spoken or remembered, and becomes a pending action.
  const proposed = hands
    ? await proposeFromReply(
        supabase,
        userId,
        hands,
        aiResult.response.content,
        convId,
        assistant.id
      )
    : null;
  const aiResponse = proposed
    ? { ...aiResult.response, content: proposed.text }
    : aiResult.response;

  // 11. Store AI response
  const apiCostBtc = aiResponse.costBtc;
  const totalCostBtc = apiCostBtc + creatorCharge;
  const aiMsgResult = await storeAssistantMessage(
    supabase,
    convId,
    aiResponse,
    assistant,
    creatorCharge,
    apiCostBtc,
    hasByok,
    proposed?.proposal ?? null
  );
  if ('error' in aiMsgResult) {
    return aiMsgResult.error;
  }
  let assistantMessage = aiMsgResult.message;
  let lastResponse = aiResponse;
  let lastPending = proposed?.pendingAction ?? null;

  // 11b. The work loop. A hand the owner switched to "on its own" for this
  //      bot runs now, and the bot is handed the result to carry on with,
  //      step by step, until it has nothing more to run or the turn's budget
  //      is spent (work-loop.ts). Every step is a stored line of the thread.
  let steps = 0;
  if (hands && proposed?.auto && proposed.proposal) {
    const actorId = await getUserActorId(supabase, userId);
    const loopHistory = [
      ...history,
      { role: 'user', content },
      { role: 'assistant', content: withProposal(proposed.text, proposed.proposal) },
    ];
    let step: Proposal | null = proposed.proposal;
    while (step && actorId && mayTakeStep(steps, timer.elapsedMs())) {
      steps += 1;
      const ranStep: Proposal = step;
      // The owner's rules come first: a step a rule forbids, or says to ask
      // about, does not run on its own. It becomes the ordinary card.
      if (botSettings?.rules && needsReview(ranStep.action, ranStep.parameters)) {
        const reviewed = await generateReply({
          hasByok,
          userKey: userOpenRouterKey,
          directKey,
          requestedModel,
          assistant,
          systemPrompt: REVIEW_SYSTEM,
          history: [],
          content: reviewQuestion(botSettings.rules, ranStep.action, ranStep.parameters),
        });
        const verdict = readVerdict('error' in reviewed ? null : reviewed.response.content);
        if (!verdict.allow) {
          steps -= 1;
          await noteHeldStep(supabase, convId, heldLine(verdict.reason), ranStep.action);
          break;
        }
      }
      // It has run: whatever happens next, it is never queued again.
      step = null;
      const ran = await runAutoStep(supabase, userId, actorId, convId, ranStep);
      const resultMessage = stepResultMessage(ranStep.action, ran.text);
      const next = await generateReply({
        hasByok,
        userKey: userOpenRouterKey,
        directKey,
        requestedModel,
        assistant,
        systemPrompt: systemPrompt ?? null,
        history: loopHistory,
        content: resultMessage,
        ownerTurn: true,
      });
      if ('error' in next) {
        // What ran has run and is in the thread; the turn ends on that line.
        logger.warn('work loop stopped: no reply', { steps }, 'AIMessagesService');
        break;
      }
      const again = await proposeFromReply(
        supabase,
        userId,
        hands,
        next.response.content,
        convId,
        assistant.id
      );
      const nextResponse = { ...next.response, content: again.text };
      const stored = await storeAssistantMessage(
        supabase,
        convId,
        nextResponse,
        assistant,
        0,
        nextResponse.costBtc,
        hasByok,
        again.proposal
      );
      if ('error' in stored) {
        break;
      }
      assistantMessage = stored.message;
      lastResponse = nextResponse;
      lastPending = again.pendingAction;
      if (!hasByok) {
        await keyService.incrementPlatformUsage(userId, 1, nextResponse.totalTokens);
      }
      loopHistory.push(
        { role: 'user', content: resultMessage },
        {
          role: 'assistant',
          content: again.proposal ? withProposal(again.text, again.proposal) : again.text,
        }
      );
      step = again.auto ? again.proposal : null;
    }
    if (step) {
      // Proposed to run on its own but not run (the turn's budget is spent, or
      // the owner has no actor): it becomes the ordinary card, never dropped.
      lastPending =
        (await queueProposalAsCard(supabase, userId, hands, step, convId)) ?? lastPending;
    }
    timer.mark('steps');
  }

  // 12. Post-message side effects. The owner's first answer to a born
  //     companion's question becomes the companion's definition (born.ts).
  if (isJobAnswer(assistant, userId, history)) {
    await adoptJob(supabase, assistant, content);
  }
  if (!hasByok) {
    await keyService.incrementPlatformUsage(userId, 1, aiResponse.totalTokens);
  }

  // 12b. Settle the charge: debit the payer's Cat Credits, credit the creator's share.
  //      Pre-authorized in step 8; idempotent on the assistant message id.
  if (admin && creatorCharge > 0) {
    await settleAssistantCharge(admin, {
      payerUserId: userId,
      creatorUserId: assistant.user_id,
      assistantId: assistant.id,
      messageId: (assistantMessage as { id: string }).id,
      chargeBtc: creatorCharge,
      model: aiResponse.model,
      totalTokens: aiResponse.totalTokens,
    });
  }

  // 12c. Remember. Detached: a memory failure must never fail a served turn.
  void extractCompanionMemories(supabase, {
    ...memoryKey,
    conversationId: convId,
    userMessage: content,
    assistantMessage: lastResponse.content,
    aiService: aiResult.chatService,
    model: aiResponse.model,
  });

  await fromTable(supabase, DATABASE_TABLES.AI_CONVERSATIONS)
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', convId);

  timer.mark('store');
  logger.info(
    'companion turn timing',
    {
      assistantId,
      ...timer.report(),
      model: aiResponse.model,
      outputTokens: aiResponse.outputTokens,
      promptChars: systemPrompt?.length ?? 0,
      hands: hands?.allowed.length ?? 0,
      steps,
    },
    'AIMessagesService'
  );

  return {
    userMessage,
    assistantMessage: {
      ...assistantMessage,
      model_name: aiResult.modelLabel,
      is_free_model: aiResponse.isFreeModel,
      used_byok: hasByok,
    },
    ...(lastPending ? { pendingAction: lastPending } : {}),
    // Steps the bot ran on its own this turn: the client re-reads the thread
    // to show each one where it happened.
    ...(steps > 0 ? { steps } : {}),
    usage: {
      inputTokens: aiResponse.inputTokens,
      outputTokens: aiResponse.outputTokens,
      totalTokens: aiResponse.totalTokens,
      apiCostBtc,
      totalCostBtc,
    },
    userStatus: {
      hasByok,
      usedFreeMessage: usesFreeMessage,
      freeMessagesRemaining: usesFreeMessage ? freeMessagesRemaining - 1 : freeMessagesRemaining,
      freeMessagesPerDay,
    },
  };
}

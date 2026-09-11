/**
 * Cat prompt preparation — the ONE place a chat exchange's message array is
 * assembled (context fetch + memory recall + custom instructions + system
 * prompt + history). Shared by:
 *   - the server chat pipeline (/api/cat/chat), which follows it with a
 *     provider call, and
 *   - /api/cat/prepare, which returns the prepared messages to the browser
 *     so a LOCAL model (Ollama / LM Studio on the user's machine) answers
 *     with exactly the same brain — same context, same memories, same page
 *     awareness — just different inference hardware.
 */

import { buildCatSystemPrompt, type ActionsVia } from '@/services/cat/system-prompt';
import { buildTurnDescriptor } from '@/services/cat/turn-descriptor';
import { getCustomInstructions } from '@/services/cat/custom-instructions';
import { buildReplyLanguageDirective } from '@/services/cat/reply-language';
import { getCatFewShotExamplesText } from '@/services/cat/few-shot-examples';
import {
  resolveConversationIdOrDefault,
  getMessagesForContext,
} from '@/services/cat/conversation-history';
import { recallMemories } from '@/services/cat/memory';
import { fetchFullContextForCat, buildFullContextString } from '@/services/ai/document-context';
import { buildAssistantRules } from '@bitbaum/ai-kit/grounding';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export interface CatChatPrepareOpts {
  message: string;
  requestedConversationId?: string;
  preferredCurrency?: string;
  locale?: string;
  lastVisitedPath?: string;
  currentPath?: string;
  currentEntity?: { type: string; ref: string };
  pageExcerpt?: string;
  /**
   * Whether the model that will answer can actually act, and how. Passed
   * straight to buildCatSystemPrompt. Omitted = 'prose', the behaviour every
   * caller had before this existed.
   */
  actionsVia?: ActionsVia;
}

export interface PreparedCatChat {
  systemPrompt: string;
  /** system + history + the user's message — ready for any chat-completions API. */
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  conversationId: string | null;
  /**
   * Everything Cat was legitimately shown this turn, for the groundedness check
   * on the way back out. Prompting alone is not a control — a weak model under
   * format pressure trades rules away, which is exactly how the sibling
   * assistant invented a contact's employer. The rules make the right answer
   * cheap; this makes the wrong one detectable.
   */
  grounding: {
    /** The rendered context — the corpus a claim about the user must trace to. */
    evidence: string[];
    /** Names of the user's own records, scoping the check to attribution. */
    subjects: string[];
  };
}

/**
 * Names of the user's own records, so the verifier can tell a claim ABOUT THEM
 * ("Elena works at X") from general economic explanation ("Lightning is fast").
 *
 * Best-effort and duck-typed: this reads across several context sub-objects
 * whose shapes evolve, and a missing name costs one unchecked sentence, whereas
 * a throw here would cost the whole turn.
 */
function collectSubjects(ctx: unknown): string[] {
  const names = new Set<string>();
  const visit = (value: unknown, depth: number) => {
    if (depth > 3 || value === null || typeof value !== 'object') {
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value.slice(0, 100)) {
        visit(v, depth + 1);
      }
      return;
    }
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'string' && /^(title|name|display_name|username|full_name)$/.test(key)) {
        const trimmed = v.trim();
        if (trimmed.length > 2) {
          names.add(trimmed);
        }
      } else if (typeof v === 'object') {
        visit(v, depth + 1);
      }
    }
  };
  visit(ctx, 0);
  return [...names];
}

export async function prepareCatChat(
  supabase: AnySupabaseClient,
  userId: string,
  opts: CatChatPrepareOpts
): Promise<PreparedCatChat> {
  const { message, requestedConversationId, ...hints } = opts;

  // Memory recall (an embedding round-trip + pgvector query) is INDEPENDENT
  // of the context fetch, so run all three concurrently — recall just has to
  // beat the (already parallel) context fetchers. Recall is best-effort: []
  // if memory is unavailable.
  const [userContext, memories, customInstructions] = await Promise.all([
    fetchFullContextForCat(supabase, userId, hints),
    recallMemories(supabase, userId, message),
    getCustomInstructions(supabase, userId),
  ]);
  userContext.memories = memories;
  const contextString = buildFullContextString(userContext);

  // Grounding rules ride between the brief and the examples.
  //
  // Placement is deliberate: AFTER the context (so "the context above" resolves)
  // and BEFORE the few-shot examples (so the examples are read as illustrations
  // of a constrained assistant rather than licence to match their confidence).
  //
  // Added only when there IS context. With nothing fetched there is nothing to
  // be grounded in, and a rule pointing at an empty block teaches a weak model
  // that the rules are decorative.
  //
  // Rule 5 explicitly protects general economic knowledge — Cat must still be
  // able to explain Lightning or Twint. The restriction is on inventing facts
  // about THIS user's people and entities, which is the failure that actually
  // costs trust. See @bitbaum/ai-kit/grounding (the packaged harness).
  const groundingRules = contextString
    ? `\n\n${buildAssistantRules({ subjectNoun: 'profile, entities, contacts and transactions' })}`
    : '';

  // Examples are appended as labeled text (not injected as fake conversation
  // turns) so weaker models can't mistake the example people for the real
  // user. The per-turn reply-language directive goes DEAD LAST: weak models
  // weight the prompt tail most, and burying the language rule mid-prompt
  // let them default to the browser locale's language.
  // History is resolved BEFORE the brief is built: whether this is the first
  // message of the conversation is an input to section selection (the
  // orientation sections fire on `first-message`), and it must be a fact read
  // from the conversation, not inferred from the wording.
  let conversationId: string | null = null;
  let historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  try {
    conversationId = await resolveConversationIdOrDefault(
      supabase,
      userId,
      requestedConversationId
    );
    historyMessages = await getMessagesForContext(supabase, userId, conversationId);
  } catch {
    /* Non-fatal — continue without history */
  }

  const turnDescriptor = buildTurnDescriptor({
    message,
    historyLength: historyMessages.length,
    currentPath: hints.currentPath,
    currentEntity: hints.currentEntity,
  });

  const systemPrompt = `${buildCatSystemPrompt({ userContext: contextString || undefined, customInstructions, actionsVia: opts.actionsVia, turnDescriptor })}${groundingRules}\n\n${getCatFewShotExamplesText()}${buildReplyLanguageDirective(message)}`;

  return {
    systemPrompt,
    messages: [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: message },
    ],
    conversationId,
    grounding: {
      // History counts as evidence: a name Cat established two turns ago is
      // fair to reuse, and treating it as novel would flag every follow-up.
      evidence: [contextString, ...historyMessages.map(m => m.content)].filter(Boolean),
      subjects: collectSubjects(userContext),
    },
  };
}

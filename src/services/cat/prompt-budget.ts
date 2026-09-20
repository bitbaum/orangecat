/**
 * Fit Cat's prompt into a token budget by giving things up in a fixed order.
 *
 * Why a ladder and not a limit: the free Groq pool refuses any single request
 * above its per-minute cap (8 000 tokens for the models it serves), and Cat's
 * system prompt alone measured 9 100 tokens in tool mode on 2026-09-11. So
 * "does it fit" was never a question of trimming a little history — the prompt
 * has to be able to shrink to the budget every time, from the least valuable
 * part first, and stop the moment it fits.
 *
 * The order is the product decision:
 *   1. old history (the model keeps the last six turns, then the last two)
 *   2. the user's context block, truncated with a visible marker
 *   3. the few-shot examples
 *   4. base sections a turn can do without, lowest value first (never the
 *      rules, the purpose, the tools, or the entity-suggestion format)
 *   5. the context entirely
 *
 * The order above is the product decision, and the expensive half of it is
 * that GENERIC PROSE IS SPENT BEFORE THE USER'S OWN DATA. What Cat knows
 * about you is the thing that makes it worth talking to; the sections are
 * advice it can mostly reconstruct. Getting this backwards does not fail
 * loudly — Cat simply answers every turn as though it had never met you.
 * If it still does not fit, `fits` is false and the caller skips the link.
 *
 * Pure: the same parts and budget always yield the same messages, which is
 * what lets a unit test pin that the real prompt fits the real cap.
 */
import {
  GROQ_CHARS_PER_TOKEN,
  estimateMessagesTokens,
  estimateTokens,
} from '@/services/ai/groq-capacity';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CatPromptParts {
  /** buildCatSystemPrompt() without context or standing instructions. */
  base: string;
  /** buildStandingInstructionsBlock(customInstructions), or ''. */
  standingInstructions: string;
  /** buildFullContextString(userContext), or ''. */
  userContext: string;
  /** Grounding rules; '' when there is no context to ground in. */
  groundingRules: string;
  fewShot: string;
  languageDirective: string;
  history: ChatMessage[];
  message: string;
}

export interface BudgetReport {
  fits: boolean;
  budgetTokens: number;
  tokens: number;
  historyKept: number;
  historyDropped: number;
  contextChars: number;
  /** Shortened, with the marker in the prompt so a thin answer has a reason. */
  contextTruncated: boolean;
  /** Gone entirely — the last resort before giving up on the link. */
  contextDropped: boolean;
  fewShotDropped: boolean;
  sectionsDropped: string[];
}

/** Base sections a turn can lose, least valuable first. */
export const DROPPABLE_SECTIONS_IN_ORDER: readonly string[] = [
  'Tappable Answers (quick replies)',
  'Response Format for Wallet Suggestions',
  'Platform Discovery (search_platform tool)',
  'Never Pigeonhole',
  'Using Context',
  'When Someone Needs Help, Not Strategy',
  'Response Format for Entity Updates',
  'Helping With Notifications (assistance scope)',
  'Multi-Entity Strategies',
  'Pricing Guidance',
  'Managing Existing Entities',
  'Economic Building Blocks',
  'Choosing the Entity Type (decision rubric — apply before EVERY proposal)',
  'Setting Up for Someone Else',
  'Drawing out what they can offer (when their Economic Profile is thin)',
  'Presenting Platform Search / Matchmaking Results',
  'Opening a Conversation',
  'Orienting a New Person (first reply)',
  'How to Think About Users',
  'Current Session Awareness',
];

/** Sections the ladder must never remove. Pinned by test. */
export const NEVER_DROPPED_SECTIONS: readonly string[] = [
  'Your Purpose',
  'Grounding & Honesty (non-negotiable)',
  "How to Respond — be useful fast, don't interrogate",
  'Response Format for Entity Suggestions',
  'Actions You Can Execute Directly',
  'Tools You Can Call',
  'Critical Rules',
];

const HISTORY_FIRST_CUT = 6;
const HISTORY_FLOOR = 2;
const CONTEXT_TRUNCATION_MARKER =
  '\n[… context shortened to fit the free tier — ask for specifics]';

export function dropSections(prompt: string, headings: readonly string[]): string {
  if (headings.length === 0) {
    return prompt;
  }
  const gone = new Set(headings);
  return prompt
    .split(/\n(?=## )/)
    .filter(chunk => {
      const heading = chunk.startsWith('## ') ? chunk.slice(3).split('\n')[0].trim() : null;
      return !(heading && gone.has(heading));
    })
    .join('\n');
}

export interface ComposeOptions {
  history: ChatMessage[];
  includeFewShot: boolean;
  /** Undefined = the whole context; a number = at most that many characters. */
  contextChars?: number;
  /** The base after any section drops. */
  base?: string;
}

/** The one place the system prompt is assembled from its parts. */
export function composeCatMessages(parts: CatPromptParts, opts: ComposeOptions): ChatMessage[] {
  const base = opts.base ?? parts.base;
  let context = parts.userContext;
  if (opts.contextChars !== undefined && context.length > opts.contextChars) {
    context =
      opts.contextChars <= CONTEXT_TRUNCATION_MARKER.length
        ? ''
        : context.slice(0, opts.contextChars - CONTEXT_TRUNCATION_MARKER.length) +
          CONTEXT_TRUNCATION_MARKER;
  }
  const head = [base, parts.standingInstructions, context].filter(Boolean).join('\n\n');
  const grounding = context ? parts.groundingRules : '';
  const fewShot = opts.includeFewShot && parts.fewShot ? `\n\n${parts.fewShot}` : '';
  const systemPrompt = `${head}${grounding}${fewShot}${parts.languageDirective}`;
  return [
    { role: 'system', content: systemPrompt },
    ...opts.history,
    { role: 'user', content: parts.message },
  ];
}

export function fitCatPromptToBudget(
  parts: CatPromptParts,
  budgetTokens: number,
  estimate: (messages: ChatMessage[]) => number = estimateMessagesTokens
): { messages: ChatMessage[]; report: BudgetReport } {
  const total = parts.history.length;
  const state = {
    history: parts.history,
    includeFewShot: true,
    contextChars: undefined as number | undefined,
    dropped: [] as string[],
  };
  // One composer for every rung, so a rung cannot accidentally measure a
  // DIFFERENT prompt than the one it is about to ship. Step 5 used to size its
  // remaining room with `{ ...state, contextChars: 0 }` — which spreads
  // `dropped`, a field composeCatMessages has never heard of, and silently
  // leaves `base` undefined. That measured the UNTRIMMED base while the real
  // prompt had already lost twenty sections. Harmless until the reorder put
  // the section drops first; after it, the baseline came out larger than the
  // budget, the room computed negative, and the context was discarded on
  // every single turn that reached step 5.
  const build = (contextChars = state.contextChars) =>
    composeCatMessages(parts, {
      history: state.history,
      includeFewShot: state.includeFewShot,
      contextChars,
      base: dropSections(parts.base, state.dropped),
    });
  const report = (messages: ChatMessage[], fits: boolean): BudgetReport => {
    // "Shortened" and "gone" are different answers to the user and must not
    // report as the same thing: below the marker's own length there is no room
    // for a marker, so the context is dropped rather than truncated.
    //
    // `state.contextChars === undefined` means the ladder NEVER TOUCHED the
    // context — it is present, whole, exactly as composed. That case has to be
    // decided before the marker comparison, because a short context is not a
    // truncated one. This previously compared an untouched context's full
    // length against the 63-character marker, so any context shorter than the
    // marker reported as DROPPED while sitting complete in the prompt.
    //
    // It is only a diagnostic, which is exactly why it was worth fixing: a
    // lying diagnostic is read by the next person trying to work out why Cat
    // sounds generic, and it sends them at the wrong thing. It sent me at the
    // wrong thing on 2026-09-20.
    if (state.contextChars === undefined) {
      return {
        fits,
        budgetTokens,
        tokens: estimate(messages),
        historyKept: state.history.length,
        historyDropped: total - state.history.length,
        contextChars: parts.userContext.length,
        contextTruncated: false,
        contextDropped: false,
        fewShotDropped: !state.includeFewShot,
        sectionsDropped: [...state.dropped],
      };
    }
    const kept = Math.min(state.contextChars, parts.userContext.length);
    const dropped = parts.userContext.length > 0 && kept <= CONTEXT_TRUNCATION_MARKER.length;
    return {
      fits,
      budgetTokens,
      tokens: estimate(messages),
      historyKept: state.history.length,
      historyDropped: total - state.history.length,
      contextChars: dropped ? 0 : kept,
      contextTruncated: !dropped && kept < parts.userContext.length,
      contextDropped: dropped,
      fewShotDropped: !state.includeFewShot,
      sectionsDropped: [...state.dropped],
    };
  };

  let messages = build();
  if (estimate(messages) <= budgetTokens) {
    return { messages, report: report(messages, true) };
  }

  // 1. History down to the last six turns.
  if (state.history.length > HISTORY_FIRST_CUT) {
    state.history = parts.history.slice(-HISTORY_FIRST_CUT);
    messages = build();
    if (estimate(messages) <= budgetTokens) {
      return { messages, report: report(messages, true) };
    }
  }

  // 2. Few-shot examples. Generic, and the base rules say the same thing.
  state.includeFewShot = false;
  messages = build();
  if (estimate(messages) <= budgetTokens) {
    return { messages, report: report(messages, true) };
  }

  // 3. Base sections, least valuable first.
  //
  // THIS RUNS BEFORE THE CONTEXT IS TOUCHED, and that ordering is the whole
  // point. It used to run after: the ladder truncated the user's own data at
  // step 2 while still carrying every one of these sections, so on an
  // ordinary turn — three messages and a two-line context — Cat dropped the
  // context ENTIRELY and answered from generic prose. Measured on
  // 2026-09-20: 14 of these 20 sections were still being dropped afterwards
  // anyway, so the context was spent to save text that did not survive
  // either. A user asking "what should I charge?" lost both their listing
  // and the Pricing Guidance section in the same turn.
  //
  // The context is the Cat's world model. It is the last thing to go, not
  // the second.
  for (const heading of DROPPABLE_SECTIONS_IN_ORDER) {
    if (!parts.base.includes(`## ${heading}`)) {
      continue;
    }
    state.dropped.push(heading);
    messages = build();
    if (estimate(messages) <= budgetTokens) {
      return { messages, report: report(messages, true) };
    }
  }

  // 4. History down to the last two turns.
  if (state.history.length > HISTORY_FLOOR) {
    state.history = parts.history.slice(-HISTORY_FLOOR);
    messages = build();
    if (estimate(messages) <= budgetTokens) {
      return { messages, report: report(messages, true) };
    }
  }

  // 5. Context truncated to whatever room is left, with a visible marker so a
  //    thin answer has a stated reason.
  //
  // The baseline has to be measured honestly. `contextChars: 0` composes a
  // prompt with NO context, and composeCatMessages only emits the grounding
  // block when there IS one — so sizing the remaining room against that
  // baseline quietly overspends by the whole grounding block. Every truncation
  // attempt then came out a handful of tokens over budget, step 5 was declared
  // impossible, and the ladder fell through to step 6 and threw the context
  // away. Measured 2026-09-20 with 2 000 tokens of room to spare: the
  // truncated prompt missed by SIX tokens and the user lost 12 000 characters
  // of their own data over it. Step 5 had never once succeeded in production.
  //
  // Budget it the way the estimator will read it back: ceil() is applied per
  // message, so charging the grounding block its own ceil is conservative and
  // the arithmetic below can only under-fill, never overflow.
  if (parts.userContext) {
    const without = estimate(build(0));
    const roomTokens = budgetTokens - without - estimateTokens(parts.groundingRules);
    const roomChars = Math.max(0, Math.floor(roomTokens * GROQ_CHARS_PER_TOKEN));
    if (roomChars < parts.userContext.length) {
      state.contextChars = roomChars;
      messages = build();
      if (estimate(messages) <= budgetTokens) {
        return { messages, report: report(messages, true) };
      }
    }
  }

  // 6. The context entirely. The last resort, as it should be.
  if (state.contextChars !== 0 && parts.userContext) {
    state.contextChars = 0;
    messages = build();
    if (estimate(messages) <= budgetTokens) {
      return { messages, report: report(messages, true) };
    }
  }

  return { messages, report: report(messages, false) };
}

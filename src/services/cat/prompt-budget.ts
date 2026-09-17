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
 * If it still does not fit, `fits` is false and the caller skips the link.
 *
 * Pure: the same parts and budget always yield the same messages, which is
 * what lets a unit test pin that the real prompt fits the real cap.
 */
import { estimateMessagesTokens } from '@/services/ai/groq-capacity';

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
  if (headings.length === 0) return prompt;
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
  const build = () =>
    composeCatMessages(parts, {
      history: state.history,
      includeFewShot: state.includeFewShot,
      contextChars: state.contextChars,
      base: dropSections(parts.base, state.dropped),
    });
  const report = (messages: ChatMessage[], fits: boolean): BudgetReport => {
    // "Shortened" and "gone" are different answers to the user and must not
    // report as the same thing: below the marker's own length there is no room
    // for a marker, so the context is dropped rather than truncated.
    const kept =
      state.contextChars === undefined
        ? parts.userContext.length
        : Math.min(state.contextChars, parts.userContext.length);
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
  if (estimate(messages) <= budgetTokens) return { messages, report: report(messages, true) };

  // 1. History down to the last six turns.
  if (state.history.length > HISTORY_FIRST_CUT) {
    state.history = parts.history.slice(-HISTORY_FIRST_CUT);
    messages = build();
    if (estimate(messages) <= budgetTokens) return { messages, report: report(messages, true) };
  }

  // 2. Context truncated to whatever room is left.
  if (parts.userContext) {
    const without = estimate(composeCatMessages(parts, { ...state, contextChars: 0 }));
    const roomTokens = budgetTokens - without;
    const roomChars = Math.max(0, Math.floor(roomTokens * 3.5));
    if (roomChars < parts.userContext.length) {
      state.contextChars = roomChars;
      messages = build();
      if (estimate(messages) <= budgetTokens) return { messages, report: report(messages, true) };
    }
  }

  // 3. Few-shot examples.
  state.includeFewShot = false;
  messages = build();
  if (estimate(messages) <= budgetTokens) return { messages, report: report(messages, true) };

  // 4. History down to the last two turns.
  if (state.history.length > HISTORY_FLOOR) {
    state.history = parts.history.slice(-HISTORY_FLOOR);
    messages = build();
    if (estimate(messages) <= budgetTokens) return { messages, report: report(messages, true) };
  }

  // 5. Base sections, least valuable first.
  for (const heading of DROPPABLE_SECTIONS_IN_ORDER) {
    if (!parts.base.includes(`## ${heading}`)) continue;
    state.dropped.push(heading);
    messages = build();
    if (estimate(messages) <= budgetTokens) return { messages, report: report(messages, true) };
  }

  // 6. The context entirely.
  if (state.contextChars !== 0 && parts.userContext) {
    state.contextChars = 0;
    messages = build();
    if (estimate(messages) <= budgetTokens) return { messages, report: report(messages, true) };
  }

  return { messages, report: report(messages, false) };
}

/**
 * A bot's hands: what a companion may propose on OrangeCat, and how.
 *
 * A companion answers on any model, with or without tool calling, so it does
 * not call tools: it PROPOSES. When the person asks it to make, create, book
 * or send something OrangeCat can do, it ends its answer with one fenced
 * block naming the action and its parameters. The server turns that block
 * into a pending Cat action, through the same permission check, spend cap
 * and consent row the Cat's own actions pass, and the chat shows the Cat's
 * "Do it?" card. Nothing runs until the person taps; a bot never says a
 * thing is done.
 *
 * One exception, and only by the owner's own switch per bot
 * (hand-grants.ts): a hand that works in the owner's Loki can be set to run
 * "on its own". Then the block runs at once, no card is queued, and the bot
 * is handed the result to carry on with (work-loop.ts). A hand that makes
 * something on OrangeCat can never be set that way.
 *
 * Only the owner's own companions get hands, and only the set below: the
 * entities the person makes for themselves, and their own Loki (read its
 * sessions and runs, ask it, send its agents a task). Nothing moves money.
 * The set is the platform's, not one bot's: every bot of the owner is
 * offered the same hands, and Loki answers each one as the Loki account
 * linked to the owner, so a bot never reaches anyone else's projects.
 *
 * A hand is offered when the person has granted it, or may grant it by
 * confirming (the Cat's grant-on-confirm rule). The one high-risk hand,
 * send_task_to_loki, is never granted by a tap: it is offered only where the
 * person already holds that permission. It waits for a tap every time unless
 * the owner switched it to run on its own for that bot (hand-grants.ts).
 */

import { CAT_ACTIONS, type CatAction } from '@/config/cat-actions';

/** The fence a proposal is written in. */
export const PROPOSAL_FENCE = 'propose';

/** Actions a companion may propose. Order is the order they are listed. */
export const COMPANION_HANDS: readonly string[] = [
  'create_event',
  'create_project',
  'create_product',
  'create_service',
  'create_wishlist',
  'send_to_loki',
  'ask_loki',
  'project_status',
  'loki_sessions',
  'loki_run_status',
  'send_task_to_loki',
  'file_loki_finding',
  'loki_finding_status',
];

/** The hands that start work in the person's repositories. Always confirmed. */
export const ACT_HANDS: readonly string[] = ['send_task_to_loki'];

export const HANDS_SECTION_HEADING = '## What you can set in motion';

export interface Proposal {
  action: string;
  parameters: Record<string, unknown>;
}

/**
 * The words with the proposal written back on the end, the way the model
 * wrote them: what the model is shown of its own earlier turns.
 *
 * The fence comes off before a reply is stored, so the chat shows words and
 * a card. Shown its stored turns as plain sentences, the model copies them:
 * live on 2026-11-01 the second "Ask Loki" in a thread came back as "I can
 * ask Loki for you." with no fence, no card, and nothing for the person to
 * tap. A proposal in the history must look like a proposal.
 */
export function withProposal(text: string, proposal: Proposal): string {
  const body = JSON.stringify({ action: proposal.action, parameters: proposal.parameters });
  return `${text.replace(/\s+$/, '')}\n\n\`\`\`${PROPOSAL_FENCE}\n${body}\n\`\`\``;
}

/** The proposal a stored message carries in its metadata, if a well-formed one. */
export function proposalFromMetadata(metadata: unknown): Proposal | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }
  const raw = (metadata as { proposal?: unknown }).proposal;
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const { action, parameters } = raw as { action?: unknown; parameters?: unknown };
  if (typeof action !== 'string' || !action.trim()) {
    return null;
  }
  return {
    action,
    parameters:
      parameters && typeof parameters === 'object' && !Array.isArray(parameters)
        ? (parameters as Record<string, unknown>)
        : {},
  };
}

/** The launch set, as actions, in order; an unknown or disabled id is skipped. */
export function handsActions(ids: readonly string[] = COMPANION_HANDS): CatAction[] {
  return ids.map(id => CAT_ACTIONS[id]).filter((a): a is CatAction => Boolean(a?.enabled));
}

/**
 * The prompt section for the hands this person has: one line per action
 * with its parameters, then the one way to use them. Short on purpose: it
 * rides every turn of every chat with the owner.
 */
export function handsSection(
  actions: readonly CatAction[],
  /** Ids the owner let this bot run without a tap. */
  autoIds: readonly string[] = []
): string | undefined {
  if (actions.length === 0) {
    return undefined;
  }
  const lines = actions.map(a => {
    const params = a.parameters
      .map(
        p =>
          `${p.name}${p.required ? '' : '?'}: ${p.type}${p.description ? ` (${p.description})` : ''}`
      )
      .join('; ');
    return `- ${a.id} — ${a.description}. Parameters: ${params}`;
  });
  const own = actions.filter(a => autoIds.includes(a.id)).map(a => a.id);
  return [
    HANDS_SECTION_HEADING,
    'OrangeCat can do these for the person, and you may propose one when they ask you to make, create, book or send such a thing, or to ask, read or task Loki (the agent system that builds and runs their projects; a task starts a coding agent session there, and its answer is read back with loki_sessions; a defect on a live app is filed with file_loki_finding):',
    ...lines,
    `To propose, first write one sentence that names what you will set up, with its main details (never only "Sure"), then end with exactly one block, the proposal itself (not a query to show, not an example):\n${exampleBlock(actions[0])}`,
    '"action" is one id from the list above, exactly as written; "parameters" holds only that action\'s fields. Write no other code block. The person taps to approve it; until then nothing exists, so never say it is done, created or sent. Propose only what they asked for, with the details they gave; ask for a missing required detail instead of inventing one. Never propose anything in a group chat.',
    ...(own.length > 0 ? [ownSentence(own)] : []),
  ].join('\n');
}

/**
 * What changes for the hands the owner switched to "on its own": the block
 * runs at once and the result comes back as the next message, so the bot
 * works through a job step by step instead of stopping at the first card.
 */
export function ownSentence(ids: readonly string[]): string {
  return `Your owner lets you run these yourself, with no tap: ${ids.join(', ')}. For these the block runs at once, and its result is given to you as the next message. Then carry on: propose the next step if one is needed, one block at a time, or tell the person what came of it, quoting the result. Never run the same step twice, and never say a result you were not given.`;
}

/** What the model is told when a hand it proposed has run on its own. */
export function stepResultMessage(actionId: string, line: string): string {
  return `[OrangeCat ran ${actionId}. Result:]\n${line}\n\n[Carry on with what the person asked. If another step is needed, propose it; if it is finished, tell them what came of it, quoting the result where it matters.]`;
}

/**
 * A complete block for one real action, required fields filled with their
 * own names. A weak model copies a worked example and drops a template:
 * live on 2026-11-01 the template `{"action": "<id>", "parameters": {...}}`
 * came back as a bare `{"question": "…"}` in a json fence, shown to the
 * person as code and never a card.
 */
function exampleBlock(action: CatAction): string {
  const parameters = Object.fromEntries(
    action.parameters.filter(p => p.required).map(p => [p.name, `<${p.name}>`])
  );
  return `\`\`\`${PROPOSAL_FENCE}\n${JSON.stringify({ action: action.id, parameters })}\n\`\`\``;
}

// A fence at the very end, tagged propose, json, or nothing: the models on
// the free tier tag it any of the three ways, and the tag is not the point.
const FENCE = /```[ \t]*(propose|json)?[ \t]*\n([\s\S]*?)\n?```\s*$/i;

/**
 * The proposal a reply ended with, taken out of the words. Only a fence at
 * the very end counts; a fence quoted mid-answer is text. Malformed JSON,
 * or parameters that are not an object, leave the reply as it is, with no
 * proposal; a `propose` fence that said nothing usable still comes off, so
 * the person is never shown it as code.
 *
 * A block with no "action" names one when `candidates` are given and
 * exactly one of them owns every key written and has every required field
 * among them: the person still sees the card name the action before any tap.
 */
export function extractProposal(
  text: string,
  candidates: ReadonlyArray<Pick<CatAction, 'id' | 'parameters'>> = []
): { text: string; proposal: Proposal | null } {
  const m = FENCE.exec(text);
  if (!m) {
    return { text, proposal: null };
  }
  const tagged = (m[1] ?? '').toLowerCase() === PROPOSAL_FENCE;
  const words = text.slice(0, m.index).replace(/\s+$/, '');
  const bare = (): { text: string; proposal: Proposal | null } => ({
    text: tagged ? words : text,
    proposal: null,
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(m[2].trim());
  } catch {
    return bare();
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return bare();
  }
  const { action, parameters } = parsed as { action?: unknown; parameters?: unknown };
  if (typeof action === 'string' && action.trim()) {
    const params =
      parameters && typeof parameters === 'object' && !Array.isArray(parameters)
        ? (parameters as Record<string, unknown>)
        : {};
    return { text: words, proposal: { action: action.trim(), parameters: params } };
  }
  const inferred = inferAction(parsed as Record<string, unknown>, candidates);
  if (!inferred) {
    return bare();
  }
  return { text: words, proposal: inferred };
}

function inferAction(
  fields: Record<string, unknown>,
  candidates: ReadonlyArray<Pick<CatAction, 'id' | 'parameters'>>
): Proposal | null {
  const keys = Object.keys(fields);
  if (keys.length === 0) {
    return null;
  }
  const owners = candidates.filter(c => {
    const names = new Set(c.parameters.map(p => p.name));
    return (
      keys.every(k => names.has(k)) && c.parameters.every(p => !p.required || keys.includes(p.name))
    );
  });
  if (owners.length !== 1) {
    return null;
  }
  return { action: owners[0].id, parameters: fields };
}

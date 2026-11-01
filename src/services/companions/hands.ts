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
 * Only the owner's own companions get hands, only the launch set below
 * (entities the person makes for themselves; nothing that moves money or
 * is high risk), and only the actions the person has granted or may grant
 * by confirming (the Cat's grant-on-confirm rule).
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
];

export const HANDS_SECTION_HEADING = '## What you can set in motion';

export interface Proposal {
  action: string;
  parameters: Record<string, unknown>;
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
export function handsSection(actions: readonly CatAction[]): string | undefined {
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
  return [
    HANDS_SECTION_HEADING,
    'OrangeCat can do these for the person, and you may propose one when they ask you to make, create, book or send such a thing:',
    ...lines,
    `To propose, first write one sentence that names what you will set up, with its main details (never only "Sure"), then end with exactly one block:\n\`\`\`${PROPOSAL_FENCE}\n{"action": "<id>", "parameters": {...}}\n\`\`\``,
    'The person taps to approve it; until then nothing exists, so never say it is done, created or sent. Propose only what they asked for, with the details they gave; ask for a missing required detail instead of inventing one. Never propose anything in a group chat.',
  ].join('\n');
}

const FENCE = new RegExp('```' + PROPOSAL_FENCE + '\\s*\\n([\\s\\S]*?)\\n?```\\s*$', 'i');

/**
 * The proposal a reply ended with, taken out of the words. Only a fence at
 * the very end counts; a fence quoted mid-answer is text. Malformed JSON, a
 * missing action or parameters that are not an object leave the reply as it
 * is, with no proposal.
 */
export function extractProposal(text: string): { text: string; proposal: Proposal | null } {
  const m = FENCE.exec(text);
  if (!m) {
    return { text, proposal: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(m[1].trim());
  } catch {
    return { text, proposal: null };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { text, proposal: null };
  }
  const { action, parameters } = parsed as { action?: unknown; parameters?: unknown };
  if (typeof action !== 'string' || !action.trim()) {
    return { text, proposal: null };
  }
  const params =
    parameters && typeof parameters === 'object' && !Array.isArray(parameters)
      ? (parameters as Record<string, unknown>)
      : {};
  return {
    text: text.slice(0, m.index).replace(/\s+$/, ''),
    proposal: { action: action.trim(), parameters: params },
  };
}

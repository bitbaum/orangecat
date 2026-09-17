/**
 * Cat Response Parser
 *
 * Parses AI responses to extract embedded action blocks.
 * Actions are encoded as ```action JSON blocks in the response text.
 *
 * Created: 2026-02-09
 * Last Modified: 2026-02-19
 * Last Modified Summary: Added suggest_wallet action parsing
 */

import {
  CAT_CREATABLE_ENTITY_TYPES,
  type SuggestedAction,
  type UpdateEntityAction,
  type PublishEntityAction,
  type SuggestedWalletAction,
  type ExecAction,
  type CatAction,
} from '@/types/cat';
import { WALLET_CATEGORIES } from '@/types/wallet';

const VALID_WALLET_CATEGORIES = Object.keys(WALLET_CATEGORIES);
const VALID_BEHAVIOR_TYPES = ['general', 'recurring_budget', 'one_time_goal'];

interface ParsedResponse {
  /** The response text with action and quick_replies blocks removed */
  message: string;
  /** Any valid action blocks found in the response */
  actions: CatAction[];
  /** Tappable answer chips the user can tap to reply in one click. */
  quickReplies?: string[];
}

// Quick replies: ```quick_replies ["...", "..."]``` — tappable answers rendered
// as chips below the message. Best-effort: a malformed or oversized block is
// dropped silently (no chips), never shown as raw text.
const QUICK_REPLIES_REGEX = /```quick_replies\s*([\s\S]*?)```/i;

function parseQuickReplies(content: string): string[] {
  const m = QUICK_REPLIES_REGEX.exec(content);
  if (!m) {
    return [];
  }
  try {
    const raw = JSON.parse(m[1].trim());
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .filter((s): s is string => typeof s === 'string')
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length <= 40)
      .slice(0, 4);
  } catch {
    return [];
  }
}

/**
 * Parse action blocks from AI response.
 * Actions are embedded as ```action or ```exec_action JSON blocks in the response content.
 * Supports: create_entity, update_entity, publish_entity, suggest_wallet, exec_action.
 * Invalid blocks (bad JSON, unknown types, missing required fields) are silently skipped.
 */
export function parseActionsFromResponse(content: string): ParsedResponse {
  const actions: CatAction[] = [];

  // Match ```action ... ``` and ```exec_action ... ``` blocks
  const actionBlockRegex = /```(?:action|exec_action)\s*([\s\S]*?)```/g;
  let match;
  let cleanedMessage = content;

  while ((match = actionBlockRegex.exec(content)) !== null) {
    try {
      const actionJson = match[1].trim();
      const raw = JSON.parse(actionJson);
      const entityTypes = CAT_CREATABLE_ENTITY_TYPES as readonly string[];

      if (
        raw.type === 'create_entity' &&
        entityTypes.includes(raw.entityType) &&
        (raw.prefill?.title || raw.prefill?.name)
      ) {
        // Groups (and any future entities) use `name` as the primary label field.
        // Normalise name→title so the UI always has action.prefill.title to display.
        if (!raw.prefill.title && raw.prefill.name) {
          raw.prefill.title = raw.prefill.name;
        }
        actions.push(raw as SuggestedAction);
      } else if (
        raw.type === 'update_entity' &&
        entityTypes.includes(raw.entityType) &&
        raw.entityId &&
        raw.updates &&
        typeof raw.updates === 'object'
      ) {
        actions.push(raw as UpdateEntityAction);
      } else if (
        raw.type === 'publish_entity' &&
        entityTypes.includes(raw.entityType) &&
        raw.entityId
      ) {
        actions.push(raw as PublishEntityAction);
      } else if (raw.type === 'suggest_wallet' && raw.prefill?.label) {
        // Validate wallet-specific fields
        const wallet = raw as SuggestedWalletAction;
        if (wallet.prefill.category && !VALID_WALLET_CATEGORIES.includes(wallet.prefill.category)) {
          wallet.prefill.category = 'general';
        }
        if (
          wallet.prefill.behavior_type &&
          !VALID_BEHAVIOR_TYPES.includes(wallet.prefill.behavior_type)
        ) {
          wallet.prefill.behavior_type = 'general';
        }
        actions.push(wallet);
      } else if (
        raw.type === 'exec_action' &&
        typeof raw.actionId === 'string' &&
        raw.actionId.length > 0 &&
        raw.parameters &&
        typeof raw.parameters === 'object'
      ) {
        actions.push(raw as ExecAction);
      }
    } catch {
      // Invalid JSON, skip this block
    }

    // Remove the action block from the message
    cleanedMessage = cleanedMessage.replace(match[0], '').trim();
  }

  cleanedMessage = stripLeakedToolCall(cleanedMessage);

  // Quick replies are parsed + stripped after action blocks (the action regex
  // never matches `quick_replies`, so the block survives the loop above).
  const quickReplies = parseQuickReplies(cleanedMessage);
  cleanedMessage = cleanedMessage.replace(QUICK_REPLIES_REGEX, '').trim();

  return {
    message: cleanedMessage,
    actions,
    quickReplies: quickReplies.length > 0 ? quickReplies : undefined,
  };
}

/**
 * A weak model sometimes opens its reply with the tool call it meant to make,
 * unfenced and often unclosed — seen live 2026-09-10:
 *
 *   {
 *     "type": "suggest_offers",
 *     "parameters": {}
 *   С радостью помогу …
 *
 * It is a tool call, not prose; it never belongs on screen. Drop it when the
 * reply STARTS with a `{ "type": … }` object: everything up to the object's
 * closing brace or, if it never closes, up to the first line that reads as
 * text (does not start with `{`, `}`, `"` or whitespace).
 */
export function stripLeakedToolCall(content: string): string {
  const head = /^\s*\{\s*"type"\s*:\s*"[a-z_]+"/i;
  if (!head.test(content)) {
    return content;
  }
  const lines = content.split('\n');
  let depth = 0;
  let cut = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i > 0 && !/^\s*["{}\[\]]/.test(line) && line.trim() !== '') {
      // Prose resumed without the object ever closing.
      cut = i;
      break;
    }
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    if (i > 0 && depth <= 0) {
      cut = i + 1;
      break;
    }
  }
  return lines.slice(cut).join('\n').trim();
}

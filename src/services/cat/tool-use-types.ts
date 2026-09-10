/**
 * Types for the Cat tool-use pipeline. Extracted verbatim from tool-use.ts (SoC)
 * and re-exported from it so the public surface is unchanged.
 */

import type { OpenRouterMessage } from '@/services/ai/openrouter';
import type { EntityType } from '@/config/entity-registry';

/** Standard chat message (system/user/assistant) */
export type { OpenRouterMessage as ChatMessage };

/** Messages that Groq can return/accept when tool-use is active */
export interface ToolCallAssistantMessage {
  role: 'assistant';
  content: string | null;
  tool_calls: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
}

export interface ToolResultMessage {
  role: 'tool';
  tool_call_id: string;
  content: string;
}

/** Full union of message types that may appear in a Groq tool-augmented conversation */
export type ToolAugmentedMessage = OpenRouterMessage | ToolCallAssistantMessage | ToolResultMessage;

/**
 * A reference to one entity surfaced by a tool call. Carries enough for the UI
 * to render a clickable link (url + type) without re-fetching.
 */
export interface ToolCallResultRef {
  url: string;
  type: string;
  title: string;
}

/**
 * Lifecycle event for a single tool invocation. Emitted by maybeEnrichWithSearchResults
 * via the onToolCall callback. The chat route relays these to the client over SSE.
 */
export type ToolCallEvent =
  | {
      id: string;
      name: string;
      status: 'running';
      args?: Record<string, unknown>;
    }
  | {
      id: string;
      name: string;
      status: 'completed';
      resultCount: number;
      results: ToolCallResultRef[];
    }
  | {
      id: string;
      name: string;
      status: 'no_results';
    }
  | {
      id: string;
      name: string;
      status: 'failed';
      error?: string;
    }
  | {
      /** An action that now waits on the confirmation card — not done, not failed. */
      id: string;
      name: string;
      status: 'pending_confirmation';
    };

export type OnToolCall = (event: ToolCallEvent) => void;

/**
 * Structured draft of an entity form, produced when the Cat calls
 * prefill_entity_form. Surfaces in the UI as a PrefilledFormCard with [Open
 * in form] / [Create] affordances instead of being narrated as prose.
 */
export interface PrefillProposal {
  entityType: EntityType;
  /** Free-text description the user gave, echoed back so the user can see what was drafted from. */
  sourceDescription: string;
  /** Field values keyed by the entity config's field names. */
  data: Record<string, unknown>;
  /** Per-field confidence 0–1 from the prefill service. */
  confidence: Record<string, number>;
}

export type OnPrefillProposal = (proposal: PrefillProposal) => void;

/** Raw tool call as returned by the provider's function-calling API. */
export type RawToolCall = {
  id: string;
  type: string;
  function: { name: string; arguments: string };
};

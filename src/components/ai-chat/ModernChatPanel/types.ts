/**
 * MODERN CHAT PANEL TYPES
 * Shared types for the chat panel components
 */

// SSOT shared types from @/types/cat
import type {
  SuggestedAction,
  SuggestedWalletAction,
  CatAction,
  ExecActionResult,
} from '@/types/cat';
export type { SuggestedAction, SuggestedWalletAction, CatAction, ExecActionResult };

/**
 * The Cat's tool-call vocabulary is defined once, by the pipeline that emits
 * it: @/services/cat/tool-use-types. These were a second, hand-kept copy of
 * ToolCallResultRef, ToolCallEvent and PrefillProposal — 55 lines of
 * discriminated union that the chat route relays over SSE and this panel
 * renders, so the two had to agree and nothing made them. Type-only
 * re-export: erased at compile, no server code enters the bundle.
 */
import type {
  ToolCallResultRef,
  ToolCallEvent,
  PrefillProposal,
} from '@/services/cat/tool-use-types';
export type { ToolCallResultRef, ToolCallEvent, PrefillProposal };

export type { FallbackNotice } from '@/lib/chat/cat-messages';

export interface PendingAction {
  id: string;
  actionId: string;
  category: string;
  parameters: Record<string, unknown>;
  description: string;
  expiresAt: string;
}

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

/**
 * If the primary provider rate-limited and the route quietly switched to the
 * fallback (typically OpenRouter free), the response carries this so the UI
 * can show a small notice — "Cat ran on the backup model because the primary
 * is rate-limited right now".
 */
export interface FallbackNotice {
  from: string;
  to: string;
  model: string;
  reason: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  modelUsed?: string;
  /** LLM provider this response came from ('groq' | 'openrouter'). */
  provider?: string;
  actions?: CatAction[];
  execResults?: ExecActionResult[];
  /** Tool calls the Cat made during this response. Rendered as chips above content. */
  toolCalls?: ToolCallEvent[];
  /** Structured form drafts (prefill_entity_form). Rendered as cards below content. */
  prefillProposals?: PrefillProposal[];
  /** Tappable answer chips — tap to reply in one click instead of typing. */
  quickReplies?: string[];
  /** Set when the route fell over from primary to fallback provider. */
  fallback?: FallbackNotice;
  /**
   * True when this task would benefit from a frontier model but answered on a
   * weaker one — the UI shows a gentle "upgrade for sharper results" nudge.
   */
  suggestUpgrade?: boolean;
}

export interface UserStatus {
  hasByok: boolean;
  freeMessagesPerDay: number;
  freeMessagesRemaining: number;
}

export interface PendingAction {
  id: string;
  actionId: string;
  category: string;
  parameters: Record<string, unknown>;
  description: string;
  expiresAt: string;
}

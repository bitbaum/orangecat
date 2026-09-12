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
 * One entity surfaced by a Cat tool call (search_platform, etc.).
 * Carries the route URL + type so the UI can link directly to the entity page.
 */
export interface ToolCallResultRef {
  url: string;
  type: string;
  title: string;
}

/**
 * A tool the Cat invoked during this response. Shown to the user as a chip
 * above the message so the work the Cat did is never invisible.
 *
 * Discriminated by `status` so consumers get proper narrowing — `results` only
 * exists on the 'completed' variant, not on every state.
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
      /**
       * An action that now waits on the confirmation card — not done, not
       * failed. `pendingActionId` is the row the card will confirm, and it is
       * the ONLY thing joining this chip to that card: the chip's own `id` is
       * the provider's tool-call id, which the confirm route has never heard
       * of. Without it the chip could only be matched by action NAME plus
       * recency, which is ambiguous the moment two of the same action are
       * waiting — so it said "needs your confirmation" forever, including
       * after the user had confirmed it.
       */
      id: string;
      name: string;
      status: 'pending_confirmation';
      pendingActionId?: string;
    }
  | {
      /**
       * The user was asked and said no. NOT a failure: nothing broke and
       * nothing is worth retrying. `pending_confirmation` exists because
       * sending a waiting action as 'failed' made the chat read "Action
       * failed" above a card waiting for a tap; collapsing a DECLINE into
       * 'failed' is the same mistake one step later.
       */
      id: string;
      name: string;
      status: 'declined';
    };

/**
 * A structured entity draft produced by the prefill_entity_form tool.
 * Rendered as a PrefilledFormCard so the user can review/edit before opening
 * the actual entity create form.
 */
export interface PrefillProposal {
  entityType: string;
  sourceDescription: string;
  data: Record<string, unknown>;
  confidence: Record<string, number>;
}

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

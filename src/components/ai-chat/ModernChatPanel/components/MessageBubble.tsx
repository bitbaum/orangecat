/**
 * MESSAGE BUBBLE COMPONENT
 * Displays a single chat message with avatar and actions
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { Cat, User, Copy, Check, Clock } from 'lucide-react';
import { getModelDisplayName } from '@/config/ai-models';
import { formatShortTime } from '@/utils/dates';
import { getModelCapabilities } from '@/config/model-capability';
import { renderChatMarkdown } from '@/utils/markdown';
import { ActionButton } from './ActionButton';
import { linkifyCitations, citationsFromToolCalls } from '@/lib/chat/citations';
import { ToolCallChip } from './ToolCallChip';
import { MessageAttachments } from './MessageAttachments';
import { parseUserMessage } from '../attachments';
import { PrefilledFormCard } from './PrefilledFormCard';
import { UpgradeNudge } from './UpgradeNudge';
import type {
  Message,
  CatAction,
  ExecActionResult,
  FallbackNotice as FallbackNoticeType,
} from '../types';
import { ENTITY_REGISTRY, ENTITY_TYPES } from '@/config/entity-registry';
import { CAT_ACTIONS } from '@/config/cat-actions';
import { AiErrorNotice } from '@/components/ai/AiErrorNotice';

const PROVIDER_LABELS: Record<string, string> = {
  groq: 'Groq',
  openrouter: 'OpenRouter',
};

const providerLabel = (id: string): string => PROVIDER_LABELS[id] ?? id;

/**
 * "X was rate-limited; answered on Y instead."
 *
 * Y was always a PROVIDER name, and the fallback chain has a same-provider hop
 * in it on purpose: Groq rations per model, so a second Groq model is a second
 * budget and a second TPM window, not a longer queue. Taking that hop printed
 * "Groq was rate-limited; answered on Groq instead" — a sentence that refutes
 * itself, on the one notice whose whole job is to be believed.
 *
 * When the provider is the same, the model is what changed, so the model is
 * what the sentence names.
 */
function ProviderFallbackNotice({ from, to, model }: FallbackNoticeType) {
  const sameProvider = from === to;
  const modelName = model ? getModelDisplayName(model) : null;

  return (
    <p className="mt-1 text-xs italic text-fg-tertiary">
      ↻{' '}
      {sameProvider ? (
        <>
          {providerLabel(from)} rate-limited that model
          {modelName ? (
            <>; answered on {modelName} instead</>
          ) : (
            '; answered on another of its models'
          )}
        </>
      ) : (
        <>
          {providerLabel(from)} was rate-limited; answered on {providerLabel(to)}
          {modelName ? <> ({modelName})</> : null} instead
        </>
      )}{' '}
      — {sameProvider ? 'still' : 'both'} on OrangeCat&apos;s free pool, not your keys.
    </p>
  );
}

// Human-readable labels for exec_action IDs — shown when no displayMessage is available.
// Entity-creation labels come from ENTITY_REGISTRY[type].name (SSOT); non-entity labels stay local.
const ENTITY_CREATE_LABELS = Object.fromEntries(
  ENTITY_TYPES.filter(t => t !== 'wallet').map(t => [`create_${t}`, ENTITY_REGISTRY[t].name])
);

const ACTION_LABELS: Record<string, string> = {
  // Productivity
  set_reminder: 'Reminder',
  create_task: 'Task',
  complete_task: 'Task',
  update_task: 'Task',
  // Communication
  post_to_timeline: 'Timeline post',
  send_message: 'Message',
  reply_to_message: 'Reply',
  // Payments & wallets
  send_payment: 'Payment',
  fund_project: 'Contribution',
  connect_wallet: 'Wallet connected',
  add_wallet: 'Wallet',
  // Context
  add_context: 'Context saved',
  update_profile: 'Profile',
  // Entities (derived from ENTITY_REGISTRY — SSOT)
  ...ENTITY_CREATE_LABELS,
  // Entity creation for concepts not in the registry but handled by the executor
  create_organization: 'Organization',
  // Entity management
  update_entity: 'Entity',
  publish_entity: 'Entity',
  archive_entity: 'Entity',
  invite_to_organization: 'Invitation',
};

function ExecResultChip({ result }: { result: ExecActionResult }) {
  const noun = ACTION_LABELS[result.actionId] ?? result.actionId;

  if (result.status === 'completed') {
    // Prefer the handler's displayMessage; fall back to generic "noun done"
    const label = result.displayMessage ?? `${noun} done`;
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-status-positive/20 bg-status-positive-subtle px-2 py-1 text-xs text-status-positive">
        <Check className="h-3 w-3 flex-shrink-0" />
        {label}
      </span>
    );
  }

  if (result.status === 'pending_confirmation') {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-status-warning/20 bg-status-warning/10 px-2 py-1 text-xs text-status-warning">
        <Clock className="h-3 w-3 flex-shrink-0" />
        {noun} — confirm below
      </span>
    );
  }

  // Failed. This used to render `${noun} failed: ${result.error}` — the raw
  // service string, straight through. That is how a user ended up staring at
  // "Entity failed: Permission denied for entities actions": an internal
  // category name, no cause they could act on, and nothing to click, while the
  // page that grants the permission already existed one link away.
  // Now the server sends a code and AiErrorNotice resolves the copy, the fix
  // link and the one-click bug report from @/config/ai-errors.
  return (
    <AiErrorNotice
      className="w-full"
      code={result.code}
      subject={noun}
      context={{
        surface: 'cat-action',
        actionId: result.actionId,
        category: CAT_ACTIONS[result.actionId]?.category,
        detail: result.error,
      }}
    />
  );
}

interface MessageBubbleProps {
  message: Message;
  isLast: boolean;
  onActionClick?: (action: CatAction) => void;
  /** Tap a quick-reply chip → send it as the next user message. */
  onQuickReply?: (text: string) => void;
  variant?: 'default' | 'focus';
}

export function MessageBubble({
  message,
  isLast,
  onActionClick,
  onQuickReply,
  variant = 'focus',
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isFocus = variant === 'focus';
  const { copied, copy } = useCopyToClipboard();

  // Clean the message content by removing action, exec_action, and quick_replies
  // blocks for display (quick_replies render as chips below, never as raw text).
  const stripped = message.content
    .replace(/```(?:action|exec_action|quick_replies)[\s\S]*?```/g, '')
    .trim();
  // A user turn may carry attached files/things (see ../attachments): show the
  // typed text, and the attachments as chips — never a wall of file contents.
  const attached = isUser ? parseUserMessage(stripped) : null;
  const displayContent = attached ? attached.text : stripped;

  // Cat cites its web sources as [F1], and the verifier checks those handles
  // mechanically. A reader who cannot reach the page is being shown the
  // APPEARANCE of a citation, which borrows the credibility of a source nobody
  // can inspect. This closes that loop; an unknown handle is deliberately left
  // as written rather than pointed at a plausible source.
  const citations = useMemo(() => citationsFromToolCalls(message.toolCalls), [message.toolCalls]);
  const linkedContent = useMemo(
    () => linkifyCitations(displayContent, citations),
    [displayContent, citations]
  );

  const handleCopy = () => void copy(linkedContent);

  return (
    <div
      className={cn(
        'flex w-full gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row',
        !isFocus && 'mx-auto max-w-3xl px-4'
      )}
    >
      {!isFocus && (
        <div
          className={cn(
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-subtle',
            isUser ? 'bg-surface-raised' : 'bg-surface-page'
          )}
        >
          {isUser ? (
            <User className="h-4 w-4 text-fg-secondary" />
          ) : (
            <Cat className="h-4 w-4 text-fg-primary" />
          )}
        </div>
      )}

      <div className={cn('min-w-0 flex-1', isUser ? 'text-right' : 'text-left')}>
        {/* Tool calls: visible chips so the user can see what Cat actually did. */}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {message.toolCalls.map(tc => (
              <ToolCallChip key={tc.id} event={tc} />
            ))}
          </div>
        )}
        {attached && <MessageAttachments attached={attached} previews={message.imagePreviews} />}
        <div
          className={cn(
            'inline-block max-w-full px-1 py-0.5 text-sm leading-relaxed sm:max-w-[92%]',
            isUser && !displayContent && 'hidden',
            isUser
              ? isFocus
                ? // Border, not just fill: surface-raised on surface-page is two
                  // greys one shade apart, so on a phone there was nothing
                  // marking where the user's turn ended and Cat's began.
                  'rounded-2xl border border-subtle bg-surface-raised px-4 py-2.5 text-fg-primary'
                : 'rounded-md rounded-tr-sm bg-fg-primary px-4 py-2.5 text-fg-inverted'
              : isFocus
                ? 'text-fg-primary'
                : 'rounded-md rounded-tl-sm bg-surface-raised px-4 py-2.5 text-fg-primary'
          )}
        >
          <div className={cn('break-words', isUser && 'whitespace-pre-wrap')}>
            {isUser ? displayContent : renderChatMarkdown(linkedContent)}
            {isLast && !isUser && !displayContent && (
              // Three unlabelled dots at the left edge of a blank screen do not
              // say who is doing what, and a screen reader announced nothing at
              // all. Named, and announced once it settles.
              <span
                className="inline-flex items-center gap-2 text-fg-secondary"
                role="status"
                aria-live="polite"
              >
                <span className="inline-flex items-center gap-1" aria-hidden="true">
                  <span
                    className="h-2 w-2 animate-bounce rounded-sm bg-fg-secondary"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-sm bg-fg-secondary"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-sm bg-fg-secondary"
                    style={{ animationDelay: '300ms' }}
                  />
                </span>
                <span className="text-xs">Cat is thinking…</span>
              </span>
            )}
          </div>
        </div>

        {/* Tappable answers — only on the latest assistant turn (older turns'
            chips would be stale). Tap sends the label as the next message. */}
        {!isUser && isLast && message.quickReplies && message.quickReplies.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.quickReplies.map((reply, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onQuickReply?.(reply)}
                className="oc-chat-reply"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        {/* Action buttons. When a prefill card is also present for an entity draft,
            suppress the redundant `create_entity` button — the card is the richer,
            single primary affordance (it can be edited + published inline). */}
        {(() => {
          if (isUser || !message.actions || message.actions.length === 0) {
            return null;
          }
          const hasPrefill = !!message.prefillProposals && message.prefillProposals.length > 0;
          const visibleActions = hasPrefill
            ? message.actions.filter(a => a.type !== 'create_entity')
            : message.actions;
          if (visibleActions.length === 0) {
            return null;
          }
          return (
            <div className="mt-3 flex flex-wrap gap-2">
              {visibleActions.map((action, idx) => (
                <ActionButton key={idx} action={action} onClick={() => onActionClick?.(action)} />
              ))}
            </div>
          );
        })()}

        {/* Exec action result chips */}
        {!isUser && message.execResults && message.execResults.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.execResults.map((result, idx) => (
              <ExecResultChip key={idx} result={result} />
            ))}
          </div>
        )}

        {/* Prefilled form proposals: cards the user can review before opening the create form */}
        {!isUser && message.prefillProposals && message.prefillProposals.length > 0 && (
          <div className="space-y-2">
            {message.prefillProposals.map((p, idx) => (
              <PrefilledFormCard key={idx} proposal={p} />
            ))}
          </div>
        )}

        {/* Provider · model indicator + copy button — provenance is honest */}
        {!isUser && message.modelUsed && displayContent && (
          <div className="flex items-center justify-between text-xs text-fg-tertiary mt-1">
            <span>
              {message.provider && PROVIDER_LABELS[message.provider] && (
                <>
                  <span title={`Powered by ${PROVIDER_LABELS[message.provider]}`}>
                    {PROVIDER_LABELS[message.provider]}
                  </span>
                  <span aria-hidden> · </span>
                </>
              )}
              <span title={message.modelUsed}>{getModelDisplayName(message.modelUsed)}</span>
              {(() => {
                const cap = getModelCapabilities(message.modelUsed);
                return (
                  <>
                    <span aria-hidden> · </span>
                    <span
                      title={cap.blurb}
                      className="cursor-help underline decoration-dotted decoration-fg-tertiary/50 underline-offset-2"
                    >
                      {cap.label}
                    </span>
                  </>
                );
              })()}
              {/* When. A thread of turns with no time on any of them gives the
                  reader nothing to anchor "did I already ask this today?" to —
                  and the timestamp was on the message object all along. */}
              {message.timestamp && (
                <>
                  <span aria-hidden> · </span>
                  <time dateTime={new Date(message.timestamp).toISOString()}>
                    {formatShortTime(message.timestamp)}
                  </time>
                </>
              )}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded p-2 text-fg-tertiary transition-colors hover:text-fg-primary"
              aria-label={copied ? 'Response copied' : 'Copy response'}
              title="Copy response"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-status-positive" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        )}

        {/* Fallback notice — shown when primary provider rate-limited and the
            route silently switched to the backup. So users know which engine
            actually answered and aren't surprised by a different tone/voice.

            It names the MODEL when the provider is unchanged. The fallback
            chain includes a second Groq model (a separate request budget and
            TPM window — see services/ai/groq-models), so a legitimate hop
            produced "Groq was rate-limited; answered on Groq instead", which
            reads as a bug and taught the user to distrust the notice. */}
        {!isUser && message.fallback && displayContent && (
          <ProviderFallbackNotice {...message.fallback} />
        )}

        {/* Upgrade nudge — only on the latest assistant turn, when this task
            would have been sharper on a frontier model. Dismissable per session. */}
        {!isUser && isLast && message.suggestUpgrade && displayContent && <UpgradeNudge />}
      </div>
    </div>
  );
}

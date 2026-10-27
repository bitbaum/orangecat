/**
 * Under each of the Cat's answers (chatkit's `thread.renderFooter`): what it
 * did, and what the person can do next.
 *
 *   tool chips      — what it looked up or ran, with their results
 *   destinations    — replies that open a page, as links (latest answer only)
 *   actions         — suggested next steps that open a form
 *   action results  — done, waiting for a confirmation, or failed (with a fix)
 *   drafts          — forms it filled in, to review before they open
 *   provenance      — provider · model · capability · time, honestly
 *   fallback        — another model answered, and which
 *   upgrade nudge   — this would have been sharper on a frontier model
 *                     (latest answer only)
 *
 * "What next" belongs under the newest answer (chatkit's `isLatest`); what
 * the Cat DID stays under every answer. The words, the reply buttons, Copy ·
 * Listen · Share and the thumbs are chatkit's own, above this. A failed turn
 * shows the links that fix it (its reason is in the bubble).
 */

import { getModelDisplayName } from '@/config/ai-models';
import { getModelCapabilities } from '@/config/model-capability';
import { formatShortTime } from '@/utils/dates';
import type { CatMessage, FallbackNotice } from '@/lib/chat/cat-messages';
import type { CatAction, ToolCallEvent } from '../types';
import { ActionButton } from './ActionButton';
import { CreateNavigation } from './CreateNavigation';
import { ExecResultChip } from './ExecResultChip';
import { PrefilledFormCard } from './PrefilledFormCard';
import { ToolCallChip } from './ToolCallChip';
import { TurnFailure } from './TurnFailure';
import { UpgradeNudge } from './UpgradeNudge';

const PROVIDER_LABELS: Record<string, string> = {
  groq: 'Groq',
  openrouter: 'OpenRouter',
};

const providerLabel = (id: string): string => PROVIDER_LABELS[id] ?? id;

/**
 * "X was rate-limited; answered on Y instead." When the provider is the same
 * (Groq rations per model, so a second Groq model is a second budget), the
 * MODEL is what changed, so the model is what the sentence names — "Groq was
 * rate-limited; answered on Groq instead" refuted itself.
 */
function ProviderFallbackNotice({ from, to, model }: FallbackNotice) {
  const sameProvider = from === to;
  const modelName = model ? getModelDisplayName(model) : null;
  return (
    <p className="mb-0 mt-1 text-xs italic text-fg-tertiary">
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

function Provenance({ message }: { message: CatMessage }) {
  if (!message.modelUsed) {
    return null;
  }
  const cap = getModelCapabilities(message.modelUsed);
  const provider = message.provider ? PROVIDER_LABELS[message.provider] : undefined;
  return (
    <p className="mb-0 mt-1 text-xs text-fg-tertiary">
      {provider && (
        <>
          <span title={`Powered by ${provider}`}>{provider}</span>
          <span aria-hidden> · </span>
        </>
      )}
      <span title={message.modelUsed}>{getModelDisplayName(message.modelUsed)}</span>
      <span aria-hidden> · </span>
      <span
        title={cap.blurb}
        className="cursor-help underline decoration-dotted decoration-fg-tertiary/50 underline-offset-2"
      >
        {cap.label}
      </span>
      {message.at && (
        <>
          <span aria-hidden> · </span>
          <time dateTime={message.at}>{formatShortTime(new Date(message.at))}</time>
        </>
      )}
    </p>
  );
}

/**
 * A chip whose action the person has since confirmed or declined. The turn's
 * stream closed long before; without this it kept saying "needs your
 * confirmation". Matched on the pending action's id, never on the action
 * NAME: two of the same action can be waiting at once.
 */
function settled(
  event: ToolCallEvent,
  answered: Readonly<Record<string, 'completed' | 'declined'>>
): ToolCallEvent {
  if (event.status !== 'pending_confirmation' || !event.pendingActionId) {
    return event;
  }
  const outcome = answered[event.pendingActionId];
  if (outcome === 'completed') {
    return { id: event.id, name: event.name, status: 'completed', resultCount: 1, results: [] };
  }
  if (outcome === 'declined') {
    return { id: event.id, name: event.name, status: 'declined' };
  }
  return event;
}

interface CatAnswerFooterProps {
  message: CatMessage;
  /** The newest answer in the thread (chatkit's `FooterInfo.isLatest`). */
  isLatest: boolean;
  onAction: (action: CatAction) => void;
  /** Pending actions the person answered since, by pending-action id. */
  answered: Readonly<Record<string, 'completed' | 'declined'>>;
}

export function CatAnswerFooter({ message, isLatest, onAction, answered }: CatAnswerFooterProps) {
  if (message.failed) {
    return <TurnFailure failure={message.failure ?? {}} />;
  }
  // A draft card is the richer way to create the same thing: no second button.
  const hasDraft = !!message.prefillProposals?.length;
  const actions = (message.actions ?? []).filter(a => !hasDraft || a.type !== 'create_entity');
  const hasWords = message.content.trim().length > 0;

  return (
    <>
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {message.toolCalls.map(tc => (
            <ToolCallChip key={tc.id} event={settled(tc, answered)} />
          ))}
        </div>
      )}
      {isLatest && message.destinations && (
        <CreateNavigation content={message.content} replies={message.destinations} />
      )}
      {actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action, idx) => (
            <ActionButton key={idx} action={action} onClick={() => onAction(action)} />
          ))}
        </div>
      )}
      {message.execResults && message.execResults.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {message.execResults.map((result, idx) => (
            <ExecResultChip key={idx} result={result} />
          ))}
        </div>
      )}
      {hasDraft && (
        <div className="mt-2 space-y-2">
          {message.prefillProposals!.map((p, idx) => (
            <PrefilledFormCard key={idx} proposal={p} />
          ))}
        </div>
      )}
      {hasWords && <Provenance message={message} />}
      {hasWords && message.fallback && <ProviderFallbackNotice {...message.fallback} />}
      {isLatest && hasWords && message.suggestUpgrade && <UpgradeNudge />}
    </>
  );
}

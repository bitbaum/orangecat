/**
 * One action the Cat ran this turn, as a chip under the answer: done, waiting
 * for the person's confirmation, or failed — the last with the fix link and
 * the one-click report from AiErrorNotice, never the raw service string.
 */

import { Check, Clock } from 'lucide-react';
import { ENTITY_REGISTRY, ENTITY_TYPES } from '@/config/entity-registry';
import { CAT_ACTIONS } from '@/config/cat-actions';
import { AiErrorNotice } from '@/components/ai/AiErrorNotice';
import type { ExecActionResult } from '../types';

// Entity-creation labels come from ENTITY_REGISTRY[type].name (SSOT);
// non-entity labels stay local.
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
  note_transaction: 'Transaction explained',
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
  propose_to_group: 'Proposal',
};

export function ExecResultChip({ result }: { result: ExecActionResult }) {
  const noun = ACTION_LABELS[result.actionId] ?? result.actionId;

  if (result.status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-status-positive/20 bg-status-positive-subtle px-2 py-1 text-xs text-status-positive">
        <Check className="h-3 w-3 flex-shrink-0" />
        {result.displayMessage ?? `${noun} done`}
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

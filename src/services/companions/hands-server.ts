/**
 * The database half of a bot's hands: which of the launch set this person
 * may be offered, and the pending action a proposal becomes.
 *
 * Both go through the Cat's own services, so a companion can propose nothing
 * the Cat could not: the permission service says granted, grantable on
 * confirmation, or no; the parameters are validated against the registry;
 * the consent row is the Cat's. The executor itself is not called here, on
 * purpose: a granted action would run at once, and a bot's proposal always
 * waits for the tap.
 */

import type { CatAction } from '@/config/cat-actions';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { validateActionParameters } from '@/services/cat/action-schemas';
import { canGrantOnConfirm, type PendingAction } from '@/services/cat/action-types';
import { createPendingAction } from '@/services/cat/pending-actions';
import { CatPermissionService } from '@/services/cat/permission-service';
import { logger } from '@/utils/logger';
import { extractProposal, handsActions, handsSection, type Proposal } from './hands';

export interface Hands {
  /** The prompt section, or undefined when the person has no hands. */
  section: string | undefined;
  /** Actions the person may be offered, with whether a tap also grants them. */
  allowed: Array<{ action: CatAction; grantOnConfirm: boolean }>;
}

/** The launch set narrowed to what this person has granted or may grant by confirming. */
export async function handsFor(supabase: AnySupabaseClient, userId: string): Promise<Hands> {
  const permissions = new CatPermissionService(supabase);
  // The grants are read once and every hand is checked against that copy, at
  // the same time. One read per hand, one after another, was a dozen round
  // trips to the database before the model was even asked: most of the wait
  // on a bare "Hi" (the set grew with every hand added).
  const stored = await permissions.getUserPermissions(userId).catch(error => {
    logger.warn('hands permissions could not be read', { error }, 'CompanionHands');
    return null;
  });
  if (!stored) {
    return { section: undefined, allowed: [] };
  }
  const checked = await Promise.all(
    handsActions().map(async (action): Promise<Hands['allowed'][number] | null> => {
      try {
        const check = await permissions.checkPermission(userId, action.id, stored);
        if (check.allowed) {
          return { action, grantOnConfirm: false };
        }
        return canGrantOnConfirm(action, check.code) ? { action, grantOnConfirm: true } : null;
      } catch (error) {
        logger.warn(
          'hands permission check failed',
          { error, actionId: action.id },
          'CompanionHands'
        );
        return null;
      }
    })
  );
  // Promise.all keeps the order of handsActions(), which is the listed order.
  const allowed = checked.filter((a): a is Hands['allowed'][number] => a !== null);
  return { section: handsSection(allowed.map(a => a.action)), allowed };
}

/**
 * The reply with its proposal taken off, and the pending action it became,
 * with the proposal as queued (validated parameters) so the stored turn can
 * show the model its own fence next time (hands.ts, withProposal).
 * A proposal for an action the person was not offered, or with parameters
 * the registry refuses, is dropped: the words stay, nothing is queued, and
 * the reason is logged so the prompt can be improved.
 */
export async function proposeFromReply(
  supabase: AnySupabaseClient,
  userId: string,
  hands: Hands,
  reply: string,
  conversationId: string
): Promise<{ text: string; pendingAction: PendingAction | null; proposal: Proposal | null }> {
  const { text, proposal } = extractProposal(
    reply,
    hands.allowed.map(a => a.action)
  );
  if (!proposal) {
    return { text, pendingAction: null, proposal: null };
  }
  const offered = hands.allowed.find(a => a.action.id === proposal.action);
  if (!offered) {
    logger.warn(
      'companion proposed an action it was not offered',
      { actionId: proposal.action },
      'CompanionHands'
    );
    return { text, pendingAction: null, proposal: null };
  }
  const validation = validateActionParameters(proposal.action, proposal.parameters);
  if (!validation.ok) {
    logger.warn(
      'companion proposal had invalid parameters',
      { actionId: proposal.action, error: validation.error },
      'CompanionHands'
    );
    return { text, pendingAction: null, proposal: null };
  }
  const parameters = validation.data ?? proposal.parameters;
  try {
    const pendingAction = await createPendingAction(supabase, userId, offered.action, parameters, {
      conversationId,
      grantOnConfirm: offered.grantOnConfirm,
    });
    // A model that wrote only the block leaves no words; the card's own
    // description stands in, so the bubble above it is never empty.
    return {
      text: text || pendingAction.description,
      pendingAction,
      proposal: { action: proposal.action, parameters },
    };
  } catch (error) {
    logger.error('companion proposal could not be queued', error, 'CompanionHands');
    return { text, pendingAction: null, proposal: null };
  }
}

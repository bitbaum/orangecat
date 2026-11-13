/**
 * The database half of a bot's hands: which of the launch set this person
 * may be offered, and the pending action a proposal becomes.
 *
 * Both go through the Cat's own services, so a companion can propose nothing
 * the Cat could not: the permission service says granted, grantable on
 * confirmation, or no; the parameters are validated against the registry;
 * the consent row is the Cat's. The executor itself is not called here, on
 * purpose: a granted action would run at once, and a bot's proposal waits
 * for the tap. A hand its owner switched to "on its own" for this bot queues
 * no card at all: it is marked `auto` and the work loop runs it over the
 * Loki rail (work-loop.ts), still without the Cat's executor.
 */

import type { CatAction } from '@/config/cat-actions';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { validateActionParameters } from '@/services/cat/action-schemas';
import { canGrantOnConfirm, type PendingAction } from '@/services/cat/action-types';
import { generateActionDescription } from '@/services/cat/action-descriptions';
import { createPendingAction } from '@/services/cat/pending-actions';
import { CatPermissionService } from '@/services/cat/permission-service';
import { getAdminClient } from '@/lib/supabase/admin';
import { CONNECTOR_HAND_PROVIDER } from '@/services/connectors/hands';
import { connectedProviders } from '@/services/connectors/token-store';
import { logger } from '@/utils/logger';
import { canRunOnItsOwn, getHandGrants, handMode } from './hand-grants';
import { extractProposal, handsActions, handsSection, type Proposal } from './hands';
import { nativeHandsSection } from './native-tools';

export interface Hands {
  /** The prompt section, or undefined when the person has no hands. */
  section: string | undefined;
  /** The same, for a model that is given the hands as functions (native-tools.ts). */
  nativeSection?: string | undefined;
  /**
   * Actions the person may be offered, with whether a tap also grants them,
   * and whether the owner let THIS bot run it without a tap (hand-grants.ts).
   */
  allowed: Array<{ action: CatAction; grantOnConfirm: boolean; auto: boolean }>;
}

/**
 * The launch set narrowed to what this person has granted or may grant by
 * confirming, and, for one bot, to what its owner left switched on.
 */
export async function handsFor(
  supabase: AnySupabaseClient,
  userId: string,
  assistantId?: string
): Promise<Hands> {
  const permissions = new CatPermissionService(supabase);
  // The grants are read once and every hand is checked against that copy, at
  // the same time. One read per hand, one after another, was a dozen round
  // trips to the database before the model was even asked: most of the wait
  // on a bare "Hi" (the set grew with every hand added).
  const [stored, grants, connected] = await Promise.all([
    permissions.getUserPermissions(userId).catch(error => {
      logger.warn('hands permissions could not be read', { error }, 'CompanionHands');
      return null;
    }),
    assistantId ? getHandGrants(supabase, userId, assistantId) : Promise.resolve(null),
    // A read of an account is offered only where that account is connected:
    // a bot is never told it can read a mailbox nobody gave it.
    connectedProviders(getAdminClient(), userId).catch(error => {
      logger.warn('connections could not be read', { error }, 'CompanionHands');
      return new Set<string>();
    }),
  ]);
  if (!stored) {
    return { section: undefined, allowed: [] };
  }
  const checked = await Promise.all(
    handsActions().map(async (action): Promise<Hands['allowed'][number] | null> => {
      const mode = handMode(grants, action.id);
      if (mode === 'off') {
        return null;
      }
      const provider = CONNECTOR_HAND_PROVIDER[action.id];
      if (provider && !connected.has(provider)) {
        return null;
      }
      // Only a hand that can run on its own ever does, whatever is stored.
      const auto = mode === 'auto' && canRunOnItsOwn(action.id);
      try {
        const check = await permissions.checkPermission(userId, action.id, stored);
        if (check.allowed) {
          return { action, grantOnConfirm: false, auto };
        }
        // Switching a hand to "on its own" is the owner's consent for that
        // hand, so it grants what a tap would have granted, and no more: a
        // high-risk hand is never granted this way (canGrantOnConfirm).
        return canGrantOnConfirm(action, check.code)
          ? { action, grantOnConfirm: true, auto }
          : null;
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
  const actions = allowed.map(a => a.action);
  const autoIds = allowed.filter(a => a.auto).map(a => a.action.id);
  return {
    section: handsSection(actions, autoIds),
    nativeSection: nativeHandsSection(actions, autoIds),
    allowed,
  };
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
  conversationId: string,
  /** The bot whose turn this is: whose browser a use_browser step drives. */
  botId?: string
): Promise<{
  text: string;
  pendingAction: PendingAction | null;
  proposal: Proposal | null;
  /** The owner let this bot run this hand without a tap. */
  auto: boolean;
}> {
  const { text, proposal } = extractProposal(
    reply,
    hands.allowed.map(a => a.action)
  );
  if (!proposal) {
    return { text, pendingAction: null, proposal: null, auto: false };
  }
  const offered = hands.allowed.find(a => a.action.id === proposal.action);
  if (!offered) {
    logger.warn(
      'companion proposed an action it was not offered',
      { actionId: proposal.action },
      'CompanionHands'
    );
    return { text, pendingAction: null, proposal: null, auto: false };
  }
  const validation = validateActionParameters(proposal.action, proposal.parameters);
  if (!validation.ok) {
    logger.warn(
      'companion proposal had invalid parameters',
      { actionId: proposal.action, error: validation.error },
      'CompanionHands'
    );
    return { text, pendingAction: null, proposal: null, auto: false };
  }
  const parameters = { ...(validation.data ?? proposal.parameters) };
  if (proposal.action === 'use_browser') {
    // Whose browser is the server's to say, never the model's: each bot has
    // its own (services/loki/browser.ts), and a model that wrote an id here
    // does not get another bot's.
    delete parameters.bot_id;
    if (botId) {
      parameters.bot_id = botId;
    }
  }
  if (offered.auto) {
    // The owner let this bot run this hand itself: no card is queued. The
    // work loop runs it and writes what happened into the thread.
    return {
      text: text || generateActionDescription(offered.action, parameters),
      pendingAction: null,
      proposal: { action: proposal.action, parameters },
      auto: true,
    };
  }
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
      auto: false,
    };
  } catch (error) {
    logger.error('companion proposal could not be queued', error, 'CompanionHands');
    return { text, pendingAction: null, proposal: null, auto: false };
  }
}

/**
 * A proposal the owner let this bot run on its own, that the turn could not
 * run (its step budget ran out, or the owner has no actor): queued as the
 * ordinary card instead, so it is never dropped without a trace.
 */
export async function queueProposalAsCard(
  supabase: AnySupabaseClient,
  userId: string,
  hands: Hands,
  proposal: Proposal,
  conversationId: string
): Promise<PendingAction | null> {
  const offered = hands.allowed.find(a => a.action.id === proposal.action);
  if (!offered) {
    return null;
  }
  try {
    return await createPendingAction(supabase, userId, offered.action, proposal.parameters, {
      conversationId,
      grantOnConfirm: offered.grantOnConfirm,
    });
  } catch (error) {
    logger.error('left-over step could not be queued', error, 'CompanionHands');
    return null;
  }
}

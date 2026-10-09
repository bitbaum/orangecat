/**
 * "@cat with instructions": doing it.
 *
 * Grok lets you tag the bot with instructions for YOUR bot. Here the Cat that
 * acts is the tagger's own: "@cat watch this project for me" creates a watch
 * in their account, as them, and then the Cat says so under the post. The
 * rules — what may run, what may only be proposed, what may be said in public
 * — are in cat-instruction.ts; this file is the wiring.
 *
 * Identity is the whole game. The executor runs here with the service-role
 * client, which bypasses RLS, so the ONLY thing deciding whose account is
 * touched is the user id passed to it. That id is the author of the tagged post
 * — checked against the queue's requester — and never anything read from the
 * thread or the model.
 *
 * A question ("@cat is this realistic?") returns false and is answered exactly
 * as before, by replyToPostMention.
 */

import { CAT_MENTION } from '@/config/cat-identity';
import { CAT_QUERY_PARAM } from '@/config/cat-door';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ROUTES } from '@/config/routes';
import { lookupUserActor } from '@/domain/actors';
import { rateLimitCatPostInstruction } from '@/lib/rate-limit';
import { CatActionExecutor } from '@/services/cat/action-executor';
import { proposeAction } from '@/services/cat/pending-actions';
import { callPlatformJson } from '@/services/cat/platform-llm';
import { loadThreadContext } from '@/services/mentions/cat-post-reply';
import {
  buildInstructionSystemPrompt,
  buildInstructionUserPrompt,
  handlesIn,
  parseInstructionDecision,
  publicReplyFor,
  type InstructionDecision,
  type InstructionOutcome,
} from '@/services/mentions/cat-instruction';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';
import { writeTimelineReply } from '@/services/timeline/write-timeline-reply';
import type { ActionResult } from '@/services/cat/action-types';
import { logger } from '@/utils/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

const LOG = 'CatPostInstruction';

/**
 * @returns true when the post was an instruction and has been answered (acted
 *   on, proposed, or explained). false means "treat it as a question".
 */
export async function actOnPostInstruction(
  admin: SupabaseClient,
  params: { eventId: string; catId: string; requesterId: string }
): Promise<boolean> {
  const { eventId, catId, requesterId } = params;

  const thread = await loadThreadContext(admin, eventId);
  const tagged = thread.find(e => e.id === eventId);
  // The tagger is the author of the tagged post, and must be who the queue
  // says asked. Anything else is not someone instructing their own Cat.
  if (!tagged || tagged.actor_id !== requesterId || tagged.actor_id === catId) {
    return false;
  }
  const taggerId = tagged.actor_id;
  const taggerText = `${tagged.description ?? ''}\n${tagged.title ?? ''}`.trim();

  const usernames = await loadUsernames(admin, [...new Set(thread.map(e => e.actor_id))]);
  const ids = new Set<string>();
  for (const e of thread) {
    ids.add(e.id);
    ids.add(e.actor_id);
    if (e.subject_id) {
      ids.add(e.subject_id);
    }
  }

  let raw: string | null = null;
  try {
    raw = await callPlatformJson(
      buildInstructionSystemPrompt(),
      buildInstructionUserPrompt({
        taggerUsername: usernames.get(taggerId) ?? 'unknown',
        taggerText,
        // The tagged post is shown as <tagger_post>; repeating it in the thread
        // would put the instruction in two places, one of them "untrusted".
        thread: thread
          .filter(e => e.id !== eventId)
          .map(e => ({
            id: e.id,
            author: usernames.get(e.actor_id) ?? 'unknown',
            text: (e.description ?? e.title ?? '').trim(),
            subjectType: e.subject_type,
            subjectId: e.subject_id,
          })),
        now: new Date(),
      }),
      { timeoutMs: 20_000 }
    );
  } catch (error) {
    logger.warn(
      'Instruction classification failed; answering instead',
      { eventId, error: error instanceof Error ? error.message : String(error) },
      LOG
    );
    return false;
  }

  const decision = parseInstructionDecision(raw, {
    taggerText,
    ids,
    usernames: new Set([...usernames.values(), ...handlesIn(taggerText)].map(u => u.toLowerCase())),
  });
  if (decision.kind === 'question') {
    return false;
  }

  const outcome = await carryOut(admin, taggerId, decision);
  if (outcome.status !== 'done') {
    await tellTaggerPrivately(admin, taggerId, outcome, taggerText);
  }

  await writeTimelineReply(admin, {
    parentEventId: eventId,
    actorId: catId,
    description: publicReplyFor(outcome),
    // Only the status — the action and its parameters stay out of public rows.
    metadata: { is_cat_reply: true, answered_event_id: eventId, cat_instruction: outcome.status },
  });
  return true;
}

async function carryOut(
  admin: SupabaseClient,
  taggerId: string,
  decision: Exclude<InstructionDecision, { kind: 'question' }>
): Promise<InstructionOutcome> {
  if (decision.kind === 'unclear') {
    logger.info('Instruction not acted on', { reason: decision.reason }, LOG);
    return { status: 'unclear' };
  }

  const limited = await rateLimitCatPostInstruction(taggerId);
  if (!limited.success) {
    return { status: 'rate_limited' };
  }

  try {
    const request = { actionId: decision.actionId, parameters: decision.parameters };
    let result: ActionResult;
    if (decision.kind === 'propose') {
      // Money and anything else needing an OK: a consent card, never a run.
      result = await proposeAction(admin, taggerId, request);
    } else {
      const actor = await lookupUserActor(admin, taggerId);
      if (!actor.ok || !actor.actorId) {
        return { status: 'failed' };
      }
      result = await new CatActionExecutor(admin).executeAction(taggerId, actor.actorId, request);
    }
    return toOutcome(result, decision.parameters);
  } catch (error) {
    logger.error(
      'Instruction from a post failed',
      {
        actionId: decision.actionId,
        error: error instanceof Error ? error.message : String(error),
      },
      LOG
    );
    return { status: 'failed' };
  }
}

function toOutcome(result: ActionResult, parameters: Record<string, unknown>): InstructionOutcome {
  switch (result.status) {
    case 'completed':
      return { status: 'done', actionId: result.actionId, parameters, data: result.data };
    case 'pending_confirmation':
      return { status: 'waiting' };
    case 'denied':
      return { status: 'denied' };
    default:
      return { status: 'failed' };
  }
}

/**
 * No dead ends: whatever did not simply happen gets a private nudge with the
 * next tap — the consent card in the Cat chat, the permissions page, or the
 * chat with their sentence already in it.
 */
async function tellTaggerPrivately(
  admin: SupabaseClient,
  taggerId: string,
  outcome: InstructionOutcome,
  taggerText: string
): Promise<void> {
  const sentence = taggerText.replace(new RegExp(CAT_MENTION, 'gi'), '').trim();
  const prefilled = `${ROUTES.DASHBOARD.CAT}?${CAT_QUERY_PARAM}=${encodeURIComponent(sentence)}`;
  const nudge =
    outcome.status === 'waiting'
      ? {
          message: 'Something you asked for under a post is waiting for your OK.',
          url: ROUTES.DASHBOARD.CAT,
        }
      : outcome.status === 'denied'
        ? {
            message: 'You asked your Cat to do something it isn’t allowed to do yet.',
            url: ROUTES.DASHBOARD.CAT_PERMISSIONS,
          }
        : outcome.status === 'rate_limited'
          ? null
          : {
              message: 'Your Cat couldn’t do this from the post — tap to finish it in chat.',
              url: prefilled,
            };
  if (!nudge) {
    return;
  }
  await NotificationDispatcher.dispatch({
    userId: taggerId,
    type: 'system',
    title: 'Your Cat has something for you',
    message: nudge.message,
    actionUrl: nudge.url,
  });
}

async function loadUsernames(admin: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) {
    return out;
  }
  const { data } = await admin.from(DATABASE_TABLES.PROFILES).select('id, username').in('id', ids);
  for (const row of (data ?? []) as Array<{ id: string; username: string | null }>) {
    if (row.username) {
      out.set(row.id, row.username);
    }
  }
  return out;
}

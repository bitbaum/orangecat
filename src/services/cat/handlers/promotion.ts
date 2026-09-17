/**
 * Promotion handlers — ADR-0007 D6, "drafts, and never posts".
 *
 * This is the one Cat action whose main job is to REFUSE. "Promote it" is the
 * promise most likely to get a user banned: Hacker News forbids generated text
 * outright, LinkedIn's user agreement prohibits bots posting and they litigate,
 * Reddit bans undisclosed self-promotion per subreddit. An agent that helpfully
 * posts on a user's behalf is an agent that loses the user their account — and
 * the account is worth more than the post.
 *
 * So the handler does not publish. It returns the channel's real constraints so
 * the model drafts something the user can safely post THEMSELVES, and it says
 * plainly which channels Cat could publish to on its own (Nostr, and this
 * platform's own timeline) rather than leaving the model to guess.
 *
 * The knowledge lives in `config/promotion-channels.ts`, not in a prompt: a
 * model asked for "a Show HN post" will cheerfully produce the exact thing HN
 * forbids, and the user carries the consequence.
 */

import {
  PROMOTION_CHANNELS,
  catMayPostTo,
  channelConstraints,
  type PromotionChannelId,
} from '@/config/promotion-channels';
import type { ActionHandler } from './types';

/** More than this and it is a campaign, not a draft. */
const MAX_CHANNELS_PER_CALL = 4;

function requestedChannels(params: Record<string, unknown>): PromotionChannelId[] {
  const raw = params.channels ?? params.channel;
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  const seen = new Set<PromotionChannelId>();
  for (const entry of list) {
    const id = String(entry).trim().toLowerCase() as PromotionChannelId;
    if (PROMOTION_CHANNELS[id]) {
      seen.add(id);
    }
  }
  return [...seen].slice(0, MAX_CHANNELS_PER_CALL);
}

export const promotionHandlers: Record<string, ActionHandler> = {
  draft_promotion: async (_supabase, _userId, _actorId, params) => {
    const channels = requestedChannels(params);
    if (channels.length === 0) {
      return {
        success: false,
        error:
          'Name at least one channel to draft for. Available: ' +
          Object.keys(PROMOTION_CHANNELS).join(', ') +
          '.',
      };
    }

    const subject = String(params.subject ?? '').trim();
    if (!subject) {
      return { success: false, error: 'Say what is being promoted.' };
    }

    const mayPost = channels.filter(catMayPostTo);
    const draftOnly = channels.filter(id => !catMayPostTo(id));

    return {
      success: true,
      data: {
        subject,
        channels,
        constraints: channels.map(channelConstraints).join('\n\n'),
        // Named explicitly so the model does not have to infer it, and so the
        // answer is the same every time it is asked.
        catMayPostTo: mayPost,
        draftOnly,
        displayMessage:
          draftOnly.length > 0
            ? `Drafted for ${channels.length} channel${channels.length === 1 ? '' : 's'} — ` +
              `${draftOnly.join(', ')} ${draftOnly.length === 1 ? 'is' : 'are'} yours to post.`
            : `Drafted for ${channels.join(', ')}.`,
        // The instruction the model must not talk itself out of.
        rule:
          draftOnly.length > 0
            ? `You CANNOT post to ${draftOnly.join(', ')}. Hand the user the text and say so ` +
              'plainly — do not imply you have posted, scheduled, or will post it.'
            : "These channels allow posting on the user's behalf, but still ask first.",
      },
    };
  },
};

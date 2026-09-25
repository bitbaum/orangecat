/**
 * Interest handlers — the user's public discoverability surface, plus topic
 * watches.
 *
 * Publishing is the only Cat action that turns something the Cat learned into
 * something other people can see, so the guard rails are deliberate: the action
 * is high-risk (never automatable), the handler re-validates the topic rather
 * than trusting the model, and removal always succeeds quietly.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { embeddingsEnabled, embedText } from '@/services/ai/embeddings';
import {
  publishInterest,
  unpublishInterest,
  isValidTopic,
  cleanTopic,
  findPeopleByInterest,
} from '../interests';
import type { ActionHandler } from './types';

/** Watches are cheap, but not unlimited — a runaway loop shouldn't fill the table. */
const MAX_ACTIVE_TOPIC_WATCHES = 20;

export const interestHandlers: Record<string, ActionHandler> = {
  publish_interest: async (supabase, userId, _actorId, params) => {
    const raw = String(params.topic ?? '');
    const result = await publishInterest(supabase, userId, raw);
    if (!result.ok) {
      return { success: false, error: result.error };
    }

    // The moment someone becomes findable is also the moment to tell them who
    // they can already find. Publishing and then saying nothing wastes the one
    // event in this system most likely to start a real conversation.
    const others = await findPeopleByInterest(supabase, userId, result.topic);
    const peers = others.map(p => ({
      displayName: p.displayName,
      username: p.username,
      profileUrl: p.profileUrl,
    }));

    const base = result.alreadyPublished
      ? `"${result.topic}" was already in your public interests.`
      : `"${result.topic}" is now on your public profile — people searching this topic can find you.`;
    const peerNote =
      peers.length > 0
        ? ` ${peers.length} other ${peers.length === 1 ? 'person is' : 'people are'} into this too: ${peers
            .map(p => (p.username ? `${p.displayName} (@${p.username})` : p.displayName))
            .join(', ')}. Offer to introduce them or to follow.`
        : '';

    return {
      success: true,
      data: {
        topic: result.topic,
        alreadyPublished: result.alreadyPublished,
        peers,
        message: base + peerNote,
      },
    };
  },

  unpublish_interest: async (supabase, userId, _actorId, params) => {
    const raw = String(params.topic ?? '');
    const result = await unpublishInterest(supabase, userId, raw);
    if (!result.ok) {
      return {
        success: false,
        error: `"${raw}" is not in your published interests — nothing to remove.`,
      };
    }
    return {
      success: true,
      data: {
        removed: result.removed,
        message: `Removed "${result.removed}" from your public interests.`,
      },
    };
  },

  watch_topic: async (supabase, userId, _actorId, params) => {
    const raw = String(params.topic ?? '');
    if (!isValidTopic(raw)) {
      return { success: false, error: `"${raw}" is not a usable topic to watch.` };
    }
    const topic = cleanTopic(raw);

    const { data: existing } = await supabase
      .from(DATABASE_TABLES.CAT_WATCHES)
      .select('id, topic')
      .eq('user_id', userId)
      .eq('kind', 'topic_match')
      .eq('status', 'active');
    const rows = (existing ?? []) as { id: string; topic: string | null }[];
    if (rows.some(r => (r.topic ?? '').toLowerCase() === topic.toLowerCase())) {
      return { success: true, data: { topic, message: `Already watching "${topic}".` } };
    }
    if (rows.length >= MAX_ACTIVE_TOPIC_WATCHES) {
      return {
        success: false,
        error: `You already have ${rows.length} active topic watches (max ${MAX_ACTIVE_TOPIC_WATCHES}).`,
      };
    }

    // Embed once, now, while the user is asking: the cat-watches timer matches
    // with this stored vector and never calls the embedding provider itself.
    const vec = embeddingsEnabled() ? await embedText(topic) : null;
    if (!vec) {
      return {
        success: false,
        error: 'Topic search is unavailable right now, so I cannot watch it.',
      };
    }
    const { error } = await supabase.from(DATABASE_TABLES.CAT_WATCHES).insert({
      user_id: userId,
      kind: 'topic_match',
      label: `Someone new is working on ${topic}`,
      topic,
      topic_embedding: JSON.stringify(vec),
    });
    if (error) {
      return { success: false, error: 'Could not set up that watch.' };
    }
    return {
      success: true,
      data: { topic, message: `Watching "${topic}" — I'll tell you as soon as someone shows up.` },
    };
  },
};

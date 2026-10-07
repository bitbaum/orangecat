/**
 * An event's cover picture, when the Cat creates the event.
 *
 * Two real sources, and an honest answer when neither is available:
 *   - the photo the person just sent in the chat (made public only now, when
 *     it goes on something public);
 *   - an image generated with their OWN AI key (never the platform's).
 * Without either, the event is still created and the reply says where a cover
 * can be added — upload, an openly licensed photo, or generation — rather than
 * the model inventing a picture URL.
 */

import { latestChatImagePath, publishChatImage } from '@/services/cat/chat-image-store';
import { generateAndStoreImage } from '@/services/images/generate-and-store';
import type { AnySupabaseClient } from '@/lib/supabase/types';

const ADD_ONE_LATER =
  'Add a cover when you edit the event: upload one, pick an openly licensed photo, or generate one.';

export interface EventCoverBrief {
  title: string;
  genres: string[];
  vibe: string | null;
  place: string | null;
}

/** What to ask an image model for: a mood, never lettering (models garble it). */
export function coverPrompt(brief: EventCoverBrief): string {
  const parts = [
    `Atmospheric cover photo for an event called "${brief.title}"`,
    brief.genres.length ? `music: ${brief.genres.join(', ')}` : '',
    brief.vibe ? `vibe: ${brief.vibe}` : '',
    brief.place ? `at ${brief.place}` : '',
  ].filter(Boolean);
  return `${parts.join('; ')}. Wide 16:9 composition, no text, no lettering, no logos.`;
}

export async function resolveEventCover(
  supabase: AnySupabaseClient,
  userId: string,
  source: unknown,
  brief: EventCoverBrief
): Promise<{ banner_url: string | null; note: string }> {
  if (source === 'chat_photo') {
    const path = await latestChatImagePath(userId);
    const url = path ? await publishChatImage(path, userId) : null;
    return url
      ? { banner_url: url, note: 'Your photo is the cover.' }
      : {
          banner_url: null,
          note: `I could not find a photo you sent in the last hour. ${ADD_ONE_LATER}`,
        };
  }
  if (source === 'generate') {
    const result = await generateAndStoreImage(supabase, userId, coverPrompt(brief));
    if (result.ok) {
      return { banner_url: result.url, note: 'I generated a cover with your AI key.' };
    }
    return { banner_url: null, note: `No cover yet — ${result.error} ${ADD_ONE_LATER}` };
  }
  return { banner_url: null, note: `No cover yet. ${ADD_ONE_LATER}` };
}

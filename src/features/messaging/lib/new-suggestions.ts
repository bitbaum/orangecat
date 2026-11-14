/**
 * Who "New" offers before anything is typed.
 *
 * An empty sheet with a search box asks a new member to already know a name.
 * So it opens on the people and agents most likely wanted: the Cat, the
 * viewer's own bots, the people they wrote with last, then the people they
 * follow. Typing replaces the list with the search.
 *
 * Pure: the transport fetches, this decides who and in what order.
 */

import type { MessengerPerson } from '@bitbaum/chatkit/messenger';
import { isPlaceholderPerson, type PickerPerson } from '../people-picker';
import type { Conversation } from '../types';

/** How many people (not agents) the sheet opens on. More is a list to read, not a choice. */
export const SUGGESTED_PEOPLE_MAX = 8;

const asPerson = (p: PickerPerson): MessengerPerson => ({
  id: p.id,
  name: p.name?.trim() || p.username || 'Someone',
  handle: p.username ?? undefined,
  avatarUrl: p.avatar_url ?? null,
});

/**
 * The people of the viewer's one-to-one conversations, newest conversation
 * first. Agents are left out (the Cat and the viewer's bots are offered by
 * name), and so is anyone who is no longer in the conversation.
 */
export function recentPeople(
  conversations: readonly Conversation[],
  viewerId: string
): PickerPerson[] {
  return conversations
    .filter(c => !c.is_group)
    .slice()
    .sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''))
    .flatMap(c => {
      const others = (c.participants ?? []).filter(p => p.user_id !== viewerId);
      const only = others.length === 1 ? others[0] : undefined;
      return only && !only.is_agent && only.is_active !== false
        ? [
            {
              id: only.user_id,
              username: only.username,
              name: only.name,
              avatar_url: only.avatar_url,
            },
          ]
        : [];
    });
}

/**
 * The list "New" opens on: agents first (each once), then people — recent
 * before followed, nobody twice, never the viewer, never an unnamed
 * placeholder account, and at most SUGGESTED_PEOPLE_MAX of them.
 */
export function newMessageSuggestions(input: {
  viewerId: string;
  agents: readonly MessengerPerson[];
  recent: readonly PickerPerson[];
  followed: readonly PickerPerson[];
}): MessengerPerson[] {
  const seen = new Set<string>([input.viewerId]);
  const agents = input.agents.filter(a => !seen.has(a.id) && seen.add(a.id));
  const people = [...input.recent, ...input.followed]
    .filter(p => p.id && !isPlaceholderPerson(p))
    .filter(p => !seen.has(p.id) && seen.add(p.id))
    .slice(0, SUGGESTED_PEOPLE_MAX)
    .map(asPerson);
  return [...agents, ...people];
}

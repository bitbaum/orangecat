/**
 * Which bots a message names.
 *
 * In a conversation of more than two, a bot answers when it is named
 * (ADR-0015 D3). The matching is the bot rooms' own (`@Name`, case- and
 * accent-insensitive, spaces optional, longest name first, and a name that
 * opens a sentence before a colon or comma), so `@LegalEagle` means the same
 * bot in a room and in Messages. Pure: the server uses it to decide who
 * answers and the browser to show who is writing.
 */

import { parseMentions } from '@/services/companions/rooms/mentions';
import type { RoomMember } from '@/services/companions/rooms/types';

/** How many bots one message can call on. Every answer is a model call. */
export const MAX_BOTS_PER_MESSAGE = 3;

export function namedBots<T extends { name: string }>(text: string, bots: readonly T[]): T[] {
  if (!text.trim() || bots.length === 0) {
    return [];
  }
  // parseMentions reads only `name`, and hands back the objects it was given.
  const found = parseMentions(text, bots as unknown as RoomMember[]).members;
  return (found as unknown as T[]).slice(0, MAX_BOTS_PER_MESSAGE);
}

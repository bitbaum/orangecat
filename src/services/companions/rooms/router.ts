/**
 * When the person addresses nobody, who answers?
 *
 * One small model call reads the message and the members' jobs and names the
 * one or two that should speak — the way a group of colleagues knows whose
 * question it is. The pick is parsed strictly (handles only, members only);
 * anything else falls back to the first member, so a router outage costs a
 * weaker choice, never silence and never a model call per member.
 */

import { completeOnPlatform } from '@/services/ai/platform-providers';
import { logger } from '@/utils/logger';
import { foldName, handleOf } from './mentions';
import type { RoomMember } from './types';

export const ROUTER_MAX_PICKS = 2;

export function routerPrompt(members: readonly RoomMember[]): string {
  const roster = members.map(m => `- ${handleOf(m.name)}${m.job ? `: ${m.job}` : ''}`).join('\n');
  return [
    'You decide which members of a group chat should answer the latest message.',
    'Members:',
    roster,
    `Answer with the handles of the one or two members (never more than ${ROUTER_MAX_PICKS}) best placed to answer, one per line, nothing else.`,
    'A greeting or a message to the whole group: answer with the first member only.',
  ].join('\n');
}

/** The handles the router wrote, as members — unknown names dropped, each once, at most two. */
export function parseRouterPick(raw: string, members: readonly RoomMember[]): RoomMember[] {
  const picks: RoomMember[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const token = foldName(line.replace(/^[\s\-*@]+/, '').split(/[\s:,]/)[0] ?? '');
    if (!token) {
      continue;
    }
    const hit = members.find(m => foldName(m.name) === token);
    if (hit && !picks.includes(hit)) {
      picks.push(hit);
    }
    if (picks.length >= ROUTER_MAX_PICKS) {
      break;
    }
  }
  return picks;
}

export async function pickResponders(
  text: string,
  members: readonly RoomMember[]
): Promise<RoomMember[]> {
  if (members.length <= 1) {
    return [...members];
  }
  try {
    const { result } = await completeOnPlatform(text, {
      systemPrompt: routerPrompt(members),
      messages: [{ role: 'user', content: text }],
      temperature: 0,
      maxTokens: 64,
    });
    return parseRouterPick(result.content, members);
  } catch (error) {
    logger.warn('room router failed; first member answers', { error }, 'CompanionRooms');
    return [];
  }
}

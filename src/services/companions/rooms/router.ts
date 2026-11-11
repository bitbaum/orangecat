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

/**
 * One line per member, "handle: yes" or "handle: no". Asked this way
 * because a small model asked to "name the one or two best placed" named
 * one: on the live site (2026-10-31, twice) a question with a medical half
 * and a legal half went to Causius alone, which then answered the medical
 * half itself. A verdict per member is a question a small model answers.
 */
export function routerPrompt(members: readonly RoomMember[]): string {
  const roster = members.map(m => `- ${handleOf(m.name)}${m.job ? `: ${m.job}` : ''}`).join('\n');
  const form = members.map(m => `${handleOf(m.name)}: yes or no`).join('\n');
  return [
    'You decide which members of a group chat should answer the latest message. Members and their jobs:',
    roster,
    'For EACH member, write one line: its handle, a colon, then "yes" if any part of the message is that member\u2019s job or asks for its expertise, otherwise "no". A message with a medical part and a legal part gets a yes from the health member AND the legal member; nobody answers in another\u2019s place.',
    'A greeting or a message to the whole group with no job in it: "yes" for the first member only.',
    'Write exactly these lines and nothing else:',
    form,
  ].join('\n');
}

/**
 * The members the router said yes to, in the order it wrote them — a line
 * "handle: no" is a no, a bare handle (the older form) is a yes — unknown
 * names dropped, each once, at most two.
 */
export function parseRouterPick(raw: string, members: readonly RoomMember[]): RoomMember[] {
  const picks: RoomMember[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const [head, ...rest] = line.replace(/^[\s\-*@]+/, '').split(/[\s:,]+/);
    const token = foldName(head ?? '');
    if (!token) {
      continue;
    }
    const verdict = rest.join(' ').trim().toLowerCase();
    if (verdict.startsWith('no')) {
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

/**
 * After a bot line, with nobody addressed: is the exchange over, or should
 * another member speak? "done" unless the person asked the members to work
 * something out together and they have not, a member was asked something,
 * or a member disagreed with what was just said.
 */
export function continuationPrompt(members: readonly RoomMember[]): string {
  const roster = members.map(m => `- ${handleOf(m.name)}${m.job ? `: ${m.job}` : ''}`).join('\n');
  return [
    'You watch a group chat between a person and these members:',
    roster,
    "The person's latest request and the latest lines follow. Decide whether another member should speak next, without being asked by name.",
    'Answer with exactly one handle when: the person asked the members to discuss, compare, challenge or agree on something and they have not finished; or the last line asked a member something; or the last line disagreed with another member who has not answered; or part of what the person asked is another member\u2019s job and that member has not spoken yet (a medical question answered by the legal member means the health member speaks next).',
    'Otherwise answer "done". One word, nothing else. Never name the member who just spoke.',
  ].join('\n');
}

export function parseContinuation(
  raw: string,
  speaker: RoomMember,
  members: readonly RoomMember[]
): RoomMember | null {
  const token = foldName(
    raw
      .trim()
      .split(/[\s:,.]/)[0]
      ?.replace(/^[\s\-*@]+/, '') ?? ''
  );
  if (!token || token === 'done') {
    return null;
  }
  const hit = members.find(m => foldName(m.name) === token);
  return hit && hit.id !== speaker.id ? hit : null;
}

export async function pickNext(args: {
  request: string;
  lines: ReadonlyArray<{ speaker: string; content: string }>;
  speaker: RoomMember;
  members: readonly RoomMember[];
}): Promise<RoomMember | null> {
  const { request, lines, speaker, members } = args;
  if (members.length <= 1) {
    return null;
  }
  const transcript = lines.map(l => `${l.speaker}: ${l.content}`).join('\n\n');
  const text = `The person asked:\n${request}\n\nLatest lines:\n${transcript}`;
  try {
    const { result } = await completeOnPlatform(text, {
      systemPrompt: continuationPrompt(members),
      messages: [{ role: 'user', content: text }],
      temperature: 0,
      maxTokens: 16,
    });
    return parseContinuation(result.content, speaker, members);
  } catch (error) {
    logger.warn('room continuation router failed; the round ends', { error }, 'CompanionRooms');
    return null;
  }
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

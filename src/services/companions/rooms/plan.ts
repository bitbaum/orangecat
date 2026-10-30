/**
 * Who answers, and who answers next — the pure half of a room turn.
 *
 * One message from the person opens a ROUND: the members it addresses answer
 * in order; a member's answer that addresses another member queues that one
 * next, so work is handed along. A round is bounded — `MAX_BOT_TURNS` lines
 * at most — because two companions can otherwise thank each other forever,
 * and every line costs a model call. The queue is carried by the client
 * between calls and re-checked here against the room's real members, so a
 * forged queue cannot make a stranger speak.
 */

import { parseMentions } from './mentions';
import type { RoomMember } from './types';

export const MIN_ROOM_MEMBERS = 2;
export const MAX_ROOM_MEMBERS = 6;
/** Bot lines one message from the person may set off, handoffs included. */
export const MAX_BOT_TURNS = 6;

export interface RoundState {
  /** Member ids still to speak, in order. */
  queue: string[];
  /** Bot lines this round may still produce. */
  turnsLeft: number;
}

/**
 * The first queue of a round. Addressed members speak; `@everyone` means all
 * of them; with nobody addressed, `routed` (the router's pick, see router.ts)
 * decides, and when even that is empty the first member answers alone — a
 * room never goes silent on a question.
 */
export function planResponders(args: {
  text: string;
  members: readonly RoomMember[];
  routed?: readonly RoomMember[];
}): RoundState {
  const { text, members } = args;
  const mentions = parseMentions(text, members);
  let speakers: RoomMember[];
  if (mentions.everyone) {
    speakers = [...members];
  } else if (mentions.members.length > 0) {
    speakers = mentions.members;
  } else if (args.routed && args.routed.length > 0) {
    speakers = [...args.routed];
  } else {
    speakers = members.slice(0, 1);
  }
  const queue = speakers.slice(0, MAX_BOT_TURNS).map(m => m.id);
  return { queue, turnsLeft: MAX_BOT_TURNS };
}

/**
 * After a member spoke: drop it from the front of the queue, queue whoever it
 * addressed (never itself, never twice in a row with the same ask), spend one
 * turn. `@everyone` from a bot addresses every OTHER member.
 */
export function nextQueue(args: {
  state: RoundState;
  speaker: RoomMember;
  reply: string;
  members: readonly RoomMember[];
}): RoundState {
  const { state, speaker, reply, members } = args;
  const turnsLeft = Math.max(0, state.turnsLeft - 1);
  const remaining = state.queue[0] === speaker.id ? state.queue.slice(1) : [...state.queue];
  const mentions = parseMentions(reply, members);
  const addressed = mentions.everyone
    ? members.filter(m => m.id !== speaker.id)
    : mentions.members.filter(m => m.id !== speaker.id);
  for (const m of addressed) {
    if (!remaining.includes(m.id)) {
      remaining.push(m.id);
    }
  }
  return { queue: turnsLeft === 0 ? [] : remaining, turnsLeft };
}

/**
 * A bot that opens with its own name ("Skeptic: Two flaws…", "**Builder**
 * — …") is labelling a line the thread already labels. The prefix goes.
 */
export function stripSelfPrefix(reply: string, speaker: RoomMember): string {
  const name = speaker.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^\\s*(?:\\*\\*)?@?${name}(?:\\*\\*)?\\s*(?:[:：]|[—–-]\\s)\\s*`, 'iu');
  return reply.replace(re, '');
}

/**
 * A bot that stages a conversation instead of having one ("Causius: …",
 * "Diplodoctor: …", "Causius: …" inside ONE line) is cut where the first
 * other voice begins, and that member is handed the floor, so the exchange
 * becomes real. One line addressed to another member ("Diplodoctor: what
 * must the note contain?") is a question, not a staged answer, and is kept:
 * a staging has either a line in the speaker's own voice or two other voices.
 */
export function cutImpersonation(
  reply: string,
  speaker: RoomMember,
  members: readonly RoomMember[]
): { text: string; handoff: RoomMember | null } {
  const lines = reply.split('\n');
  const voices: Array<{ line: number; member: RoomMember }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
      .replace(/^[\s>*\-•#]+/, '')
      .replace(/\*\*/g, '')
      .trimStart();
    const low = line.toLowerCase();
    for (const m of members) {
      const name = m.name.trim().toLowerCase();
      const start = low.startsWith(`@${name}`)
        ? name.length + 1
        : low.startsWith(name)
          ? name.length
          : -1;
      if (start >= 0 && /^\s*[:：]|^\s+[—–-]\s/.test(line.slice(start))) {
        voices.push({ line: i, member: m });
        break;
      }
    }
  }
  const others = voices.filter(v => v.member.id !== speaker.id);
  const staged = voices.some(v => v.member.id === speaker.id) || others.length >= 2;
  const first = others[0];
  if (!staged || !first || first.line === 0) {
    return { text: reply, handoff: null };
  }
  return { text: lines.slice(0, first.line).join('\n').trim(), handoff: first.member };
}

/**
 * A queue that arrived from the client, made safe: only real members, no
 * repeats, never longer than the turns left, never more turns than a round has.
 */
export function sanitizeRound(state: unknown, members: readonly RoomMember[]): RoundState {
  const ids = new Set(members.map(m => m.id));
  const raw = (state ?? {}) as { queue?: unknown; turnsLeft?: unknown };
  const turnsLeft =
    typeof raw.turnsLeft === 'number' && Number.isFinite(raw.turnsLeft)
      ? Math.max(0, Math.min(MAX_BOT_TURNS, Math.floor(raw.turnsLeft)))
      : 0;
  const queue: string[] = [];
  if (Array.isArray(raw.queue)) {
    for (const id of raw.queue) {
      if (typeof id === 'string' && ids.has(id) && !queue.includes(id)) {
        queue.push(id);
      }
    }
  }
  return { queue: queue.slice(0, turnsLeft), turnsLeft };
}

/** A room title nobody typed: the members' names, "Ada, Lex & Diplodoctor". */
export function deriveRoomTitle(names: readonly string[]): string {
  const clean = names.map(n => n.trim()).filter(Boolean);
  if (clean.length === 0) {
    return 'Group chat';
  }
  if (clean.length === 1) {
    return clean[0];
  }
  return `${clean.slice(0, -1).join(', ')} & ${clean[clean.length - 1]}`;
}

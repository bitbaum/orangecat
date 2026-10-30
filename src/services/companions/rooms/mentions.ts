/**
 * `@Name` in a room.
 *
 * The person writes `@Diplodoctor check the second value`, a companion writes
 * `@Legal eagle is that a deadline?` — either hands the next turn to that
 * member. Matching is by name, case- and accent-insensitive, with the spaces
 * optional (`@LegalEagle` and `@Legal eagle` are the same member), longest
 * name first so `@Max Planck` is not read as `@Max`. `@everyone` addresses
 * the whole room.
 */

import type { RoomMember } from './types';

export const EVERYONE = 'everyone';

export interface Mentions {
  /** Mentioned members, in order of first appearance, each once. */
  members: RoomMember[];
  everyone: boolean;
}

/** "Legal Eagle" → "legaleagle": what an `@` is compared against. */
export function foldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** The handle shown to the person as the way to address a member: `@LegalEagle`. */
export function handleOf(name: string): string {
  return name.replace(/[^\p{L}\p{N}]+/gu, '');
}

export function parseMentions(text: string, members: readonly RoomMember[]): Mentions {
  const found: RoomMember[] = [];
  let everyone = false;
  // Longest names first, so a member whose name begins with another's name wins.
  const byLength = [...members].sort((a, b) => b.name.length - a.name.length);
  const at = /(^|[^\p{L}\p{N}@])@/gu;
  let m: RegExpExecArray | null;
  while ((m = at.exec(text)) !== null) {
    const start = m.index + m[0].length;
    const rest = text.slice(start);
    if (/^everyone\b/i.test(rest)) {
      everyone = true;
      continue;
    }
    const hit = byLength.find(member => startsWithName(rest, member.name));
    if (hit && !found.includes(hit)) {
      found.push(hit);
    }
  }
  return { members: found, everyone };
}

/**
 * Does `rest` begin with `name`, letters compared folded, spaces in the name
 * optional, and the match ending at a word boundary?
 */
function startsWithName(rest: string, name: string): boolean {
  const target = foldName(name);
  if (!target) {
    return false;
  }
  let consumed = '';
  let i = 0;
  for (; i < rest.length && consumed.length < target.length; i++) {
    const ch = rest[i];
    const folded = foldName(ch);
    if (!folded) {
      // Punctuation or a space inside the handle is allowed only where the
      // name itself breaks ("Legal eagle"), and never at the very start.
      if (ch === ' ' && consumed.length > 0) {
        continue;
      }
      return false;
    }
    if (!target.startsWith(consumed + folded)) {
      return false;
    }
    consumed += folded;
  }
  if (consumed !== target) {
    return false;
  }
  const after = rest[i];
  return after === undefined || !/[\p{L}\p{N}]/u.test(after);
}

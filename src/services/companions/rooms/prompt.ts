/**
 * What a companion is told when it speaks in a room, and how the room's
 * transcript is laid out for it.
 *
 * The companion's own definition (its creator's system prompt) stays
 * sovereign and comes first, as in a one-to-one thread. Under it, one short
 * section says where it is: who else is here, that it speaks as itself only,
 * and that `@Name` hands the floor on. Nothing else is layered on — no
 * platform persona — the same restraint `system-prompt.ts` keeps.
 */

import { handleOf } from './mentions';
import type { RoomMember, RoomMessage } from './types';

export const ROOM_SECTION_HEADING = '## The room';

/** Lines of transcript a member is shown. */
export const ROOM_HISTORY = 30;

export function buildRoomPrompt(args: {
  speaker: RoomMember;
  members: readonly RoomMember[];
  definition: string | null | undefined;
}): string {
  const { speaker, members, definition } = args;
  const others = members.filter(m => m.id !== speaker.id);
  const roster = others.map(m => `- @${handleOf(m.name)}${m.job ? ` — ${m.job}` : ''}`).join('\n');
  const section = [
    ROOM_SECTION_HEADING,
    `You are ${speaker.name}, in a group chat with the person and these companions:`,
    roster || '- (nobody else yet)',
    `Speak as ${speaker.name} only; never write lines for anyone else and never start your reply with your own name.`,
    'Lines from the others arrive as "Name: …". Answer the person first; answer a companion when it asked you something.',
    'When you need something from another companion, address it once with its @handle and it will answer next. Do not @ anyone just to be polite.',
    'Keep it to a few sentences: this is a conversation, not a report.',
  ].join('\n');
  const base = definition?.trim() ?? '';
  return base ? `${base}\n\n${section}` : section;
}

/**
 * The room's last lines as a model conversation for ONE member: the person's
 * lines are `user`, the member's own lines are `assistant`, and every other
 * member's line is a `user` turn prefixed with its name — so the model reads
 * the others as people in the room, not as itself.
 */
export function transcriptFor(
  messages: readonly RoomMessage[],
  speaker: RoomMember
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const recent = messages.slice(-ROOM_HISTORY);
  const out: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const m of recent) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content });
    } else if (m.memberId === speaker.id) {
      out.push({ role: 'assistant', content: m.content });
    } else {
      out.push({ role: 'user', content: `${m.speaker ?? 'Someone'}: ${m.content}` });
    }
  }
  return out;
}

/**
 * A model turn ends on a `user` line. When the last thing said was the
 * speaker's own line (it was queued twice), it is asked to go on.
 */
export function splitForModel(transcript: Array<{ role: 'user' | 'assistant'; content: string }>): {
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  content: string;
} {
  const last = transcript[transcript.length - 1];
  if (!last || last.role !== 'user') {
    return { history: transcript, content: 'Go on.' };
  }
  return { history: transcript.slice(0, -1), content: last.content };
}

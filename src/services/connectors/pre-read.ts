/**
 * The read happens in code, before the model speaks.
 *
 * A model is the part that puts things into words. Whether a person's
 * calendar gets opened when they ask about their week should not depend on
 * how well that model chooses tools: the weakest free model on the chain
 * cannot be trusted to call `calendar_read`, and the strongest should not
 * have to spend a round trip deciding to. So the turn's own words decide.
 * A message that plainly asks about the calendar, the to-do list or the
 * mail has the read
 * run here, as the person, and the result is put in front of whichever
 * model answers. All that is left for the model is to say what it shows.
 *
 * Only on a plain ask, never on every turn: a mailbox is not handed to a
 * model that was asked about something else. Anything narrower than the
 * default read (one message, a search for a sender) is still the model's to
 * ask for with `gmail_read` / `calendar_read`.
 *
 * Nothing here calls a model.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { PLANNER_HANDS } from '@/services/planner/hands';
import { CONNECTOR_HANDS, OUTSIDE_CONTENT_NOTE } from './hands';

export interface ConnectorIntent {
  /** Read the calendar this many days ahead. */
  calendar?: { days: number };
  /** Search the mail with these Gmail words. */
  mail?: { query: string };
  /** Read what is open on the to-do list. */
  tasks?: true;
}

const CALENDAR =
  /\b(calendar|kalender|agenda|schedule|appointments?|meetings?|termin(e|en|kalender)?|besprechung(en)?)\b/i;
/** "What do I have next week", "what's on tomorrow", "was steht morgen an". */
const WHAT_IS_ON =
  /\b(what('?s| is| do i have| should i do)|was (steht|habe ich|ist|soll ich)|anything)\b[^.?!]{0,40}\b(today|tonight|tomorrow|this week|next week|weekend|heute|morgen|diese woche|n[aä]chste woche|wochenende)\b/i;
/** The mailbox as a thing to look in; "email me when…" is a verb, not the inbox. */
const MAIL =
  /\b(e-?mails?(?!\s+(me|us|him|her|them|it|to)\b)|inbox|mailbox|posteingang|post ?fach|gmail)\b|\bmy mail\b|\bmeine mails?\b/i;
/** The list as a thing to look at; "create a task" is an instruction, not a look. */
const TASKS =
  /\b(to-?dos?( list)?|task list|my tasks|open tasks|aufgaben(liste)?|meine aufgaben|what (should|do) i (need to )?do|what needs my attention|was (muss|soll) ich (tun|machen|erledigen))\b/i;
const UNREAD = /\b(unread|ungelesen\w*|new mails?|neue mails?)\b/i;

/** How far ahead the words reach: the day asked about, and a week when unsaid. Pure. */
export function calendarReach(message: string): number {
  if (/\b(next week|n[aä]chste woche|next 2 weeks|two weeks)\b/i.test(message)) {
    return 14;
  }
  if (/\b(this month|diesen monat|next month|n[aä]chsten monat)\b/i.test(message)) {
    return 31;
  }
  if (/\b(tomorrow|morgen)\b/i.test(message)) {
    return 2;
  }
  if (/\b(today|tonight|heute)\b/i.test(message)) {
    return 1;
  }
  return 7;
}

/** What the person's own words plainly ask to have read, or null. Pure. */
export function connectorIntent(message: string): ConnectorIntent | null {
  const text = message.slice(0, 600);
  const intent: ConnectorIntent = {};
  if (CALENDAR.test(text) || WHAT_IS_ON.test(text)) {
    intent.calendar = { days: calendarReach(text) };
  }
  if (MAIL.test(text)) {
    intent.mail = { query: UNREAD.test(text) ? 'is:unread in:inbox' : 'in:inbox newer_than:7d' };
  }
  if (TASKS.test(text)) {
    intent.tasks = true;
  }
  return intent.calendar || intent.mail || intent.tasks ? intent : null;
}

export interface PreRead {
  /** What goes in front of the model. */
  block: string;
  /** What was read, for the check that an answer says only what it was shown. */
  evidence: string[];
}

type Hand = (
  supabase: AnySupabaseClient,
  userId: string,
  params: Record<string, unknown>
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

/** The reads a message can set off: the person's own planner, and their connected mail. */
const READS: Readonly<Record<string, Hand>> = {
  calendar_read: PLANNER_HANDS.calendar_read,
  tasks_read: PLANNER_HANDS.tasks_read,
  gmail_read: (_supabase, userId, params) => CONNECTOR_HANDS.gmail_read(userId, params),
};

/** The person's own list is their words; a calendar or a mailbox carries other people's. */
const OUTSIDE = new Set(['calendar_read', 'gmail_read']);

const shown = (outcome: { success: boolean; data?: unknown; error?: string }): string =>
  outcome.success
    ? String((outcome.data as { text?: unknown } | undefined)?.text ?? '')
    : `It could not be read: ${outcome.error ?? 'no reason given'}`;

/**
 * Run what the message plainly asks for and return it as a block for the
 * model. `allowed` narrows it (a bot's hand that is switched off, or an
 * account that is not connected, is simply not read). Never throws.
 */
export async function preReadForTurn(
  supabase: AnySupabaseClient,
  userId: string,
  message: string,
  opts: { allowed?: (handId: string) => boolean; hands?: Readonly<Record<string, Hand>> } = {}
): Promise<PreRead | null> {
  const intent = connectorIntent(message);
  if (!intent) {
    return null;
  }
  const hands = opts.hands ?? READS;
  const may = opts.allowed ?? (() => true);
  const jobs: Array<Promise<{ title: string; text: string; ok: boolean; outside: boolean }>> = [];
  const run = (handId: string, title: string, params: Record<string, unknown>) => {
    if (!may(handId) || !hands[handId]) {
      return;
    }
    jobs.push(
      hands[handId](supabase, userId, params)
        .catch(() => ({ success: false, error: 'the read failed just now' }))
        .then(outcome => ({
          title,
          text: shown(outcome),
          ok: outcome.success,
          outside: OUTSIDE.has(handId),
        }))
    );
  };
  if (intent.calendar) {
    run('calendar_read', 'Their calendar', { days: intent.calendar.days });
  }
  if (intent.tasks) {
    run('tasks_read', 'Their to-do list', {});
  }
  if (intent.mail) {
    run('gmail_read', 'Their mail', { query: intent.mail.query });
  }
  const parts = await Promise.all(jobs);
  if (parts.length === 0) {
    return null;
  }
  const read = parts.some(p => p.ok && p.outside);
  return {
    block: [
      '## Read just now, for this message',
      'The person asked about this, so it was read for you, as them, before you answer. Answer from it. Do not call a tool to read the same thing again, and do not say you cannot see it. Where a read failed, say so in one plain sentence with the reason given, and nothing invented in its place.',
      ...parts.map(p => `### ${p.title}\n${p.text}`),
      ...(read ? [OUTSIDE_CONTENT_NOTE] : []),
    ].join('\n\n'),
    evidence: parts.filter(p => p.ok).map(p => p.text),
  };
}

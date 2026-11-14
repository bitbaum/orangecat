/**
 * What a bot or the Cat can read in a person's connected Google account, on
 * request: their mail (a search, or one message) and their calendar (the
 * coming days). Read-only: the token holds gmail.readonly and
 * calendar.readonly and every call here is a GET.
 */

import { googleGet, type GoogleAnswer } from '@/services/google/connection';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const CALENDAR = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export const MAIL_LIST_MAX = 10;
/** One message is handed to a model: the start of a long thread is enough. */
export const MAIL_BODY_MAX_CHARS = 6000;
export const MAIL_DEFAULT_QUERY = 'in:inbox newer_than:7d';
export const CALENDAR_DAYS_MAX = 31;
export const CALENDAR_DAYS_DEFAULT = 7;
const CALENDAR_LIST_MAX = 30;

const MESSAGE_ID = /^[A-Za-z0-9_-]{6,64}$/;

interface GmailHeader {
  name?: string;
  value?: string;
}
interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
  headers?: GmailHeader[];
}
export interface GmailMessage {
  id: string;
  snippet?: string;
  labelIds?: string[];
  payload?: GmailPart;
}

function header(message: GmailMessage, name: string): string {
  const found = message.payload?.headers?.find(h => h.name?.toLowerCase() === name.toLowerCase());
  return (found?.value ?? '').trim();
}

/** The first text/plain part, else text/html with its tags taken off. Pure. */
export function mailBody(part: GmailPart | undefined): string {
  const decode = (data?: string) => (data ? Buffer.from(data, 'base64url').toString('utf8') : '');
  const find = (p: GmailPart | undefined, mime: string): string => {
    if (!p) {
      return '';
    }
    if (p.mimeType === mime && p.body?.data) {
      return decode(p.body.data);
    }
    for (const child of p.parts ?? []) {
      const hit = find(child, mime);
      if (hit) {
        return hit;
      }
    }
    return '';
  };
  const plain = find(part, 'text/plain');
  if (plain) {
    return plain.trim();
  }
  return find(part, 'text/html')
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mailListText(messages: readonly GmailMessage[], query: string): string {
  if (messages.length === 0) {
    return `No mail matches "${query}".`;
  }
  return [
    `${messages.length} messages for "${query}", newest first:`,
    ...messages.map(
      m =>
        `- ${header(m, 'Date')} · ${header(m, 'From')} · ${header(m, 'Subject') || '(no subject)'}` +
        `${m.labelIds?.includes('UNREAD') ? ' · unread' : ''} · id ${m.id}` +
        `${m.snippet ? `\n  ${m.snippet}` : ''}`
    ),
  ].join('\n');
}

export function mailMessageText(message: GmailMessage): string {
  const body = mailBody(message.payload);
  const cut = body.length > MAIL_BODY_MAX_CHARS;
  return [
    `From: ${header(message, 'From')}`,
    `To: ${header(message, 'To')}`,
    `Date: ${header(message, 'Date')}`,
    `Subject: ${header(message, 'Subject') || '(no subject)'}`,
    '',
    cut ? `${body.slice(0, MAIL_BODY_MAX_CHARS)}\n… (cut; the message is longer)` : body,
  ].join('\n');
}

type Read = { ok: true; text: string } | { ok: false; error: string };

function refusal<T>(answer: GoogleAnswer<T>, what: string): string {
  if (answer.ok) {
    return '';
  }
  if (answer.status === 403) {
    return `Google refused: reading your ${what} was not allowed when you connected. Reconnect Google in Cat → Controls and leave ${what} ticked.`;
  }
  if (answer.status === 401) {
    return 'Google no longer accepts this connection. Reconnect Google in Cat → Controls.';
  }
  return 'Google did not answer just now.';
}

/** A mail search, or one message by the id a search returned. Never throws. */
export async function readMail(token: string, params: Record<string, unknown>): Promise<Read> {
  const id = typeof params.message_id === 'string' ? params.message_id.trim() : '';
  if (id) {
    if (!MESSAGE_ID.test(id)) {
      return { ok: false, error: 'A message is read by the id a mail search returned.' };
    }
    const one = await googleGet<GmailMessage>(token, `${GMAIL}/messages/${id}?format=full`);
    return one.ok
      ? { ok: true, text: mailMessageText(one.data) }
      : { ok: false, error: refusal(one, 'mail') };
  }
  const query =
    (typeof params.query === 'string' ? params.query.trim().slice(0, 300) : '') ||
    MAIL_DEFAULT_QUERY;
  const list = await googleGet<{ messages?: Array<{ id: string }> }>(
    token,
    `${GMAIL}/messages?maxResults=${MAIL_LIST_MAX}&q=${encodeURIComponent(query)}`
  );
  if (!list.ok) {
    return { ok: false, error: refusal(list, 'mail') };
  }
  const messages = await Promise.all(
    (list.data.messages ?? []).map(m =>
      googleGet<GmailMessage>(
        token,
        `${GMAIL}/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
      )
    )
  );
  return {
    ok: true,
    text: mailListText(
      messages.flatMap(m => (m.ok ? [m.data] : [])),
      query
    ),
  };
}

export interface CalendarEvent {
  summary?: string;
  location?: string;
  htmlLink?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email?: string; self?: boolean }>;
}

/** How many days ahead, from what was asked: 1 to 31, a week when unsaid. Pure. */
export function calendarDays(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, CALENDAR_DAYS_MAX) : CALENDAR_DAYS_DEFAULT;
}

export function calendarText(events: readonly CalendarEvent[], days: number): string {
  const span = days === 1 ? 'the next day' : `the next ${days} days`;
  const live = events.filter(e => e.status !== 'cancelled');
  if (live.length === 0) {
    return `Nothing in your calendar for ${span}.`;
  }
  return [
    `${live.length} events in ${span}:`,
    ...live.map(e => {
      const when = e.start?.dateTime
        ? `${e.start.dateTime}${e.end?.dateTime ? ` to ${e.end.dateTime}` : ''}`
        : `${e.start?.date ?? ''} (all day)`;
      const others = (e.attendees ?? []).filter(a => !a.self && a.email).length;
      return (
        `- ${when} · ${e.summary || '(no title)'}` +
        `${e.location ? ` · ${e.location}` : ''}${others ? ` · with ${others} other${others === 1 ? '' : 's'}` : ''}`
      );
    }),
  ].join('\n');
}

/** The primary calendar's events from now, a number of days ahead. Never throws. */
export async function listCalendarEvents(
  token: string,
  params: Record<string, unknown>,
  now: Date = new Date()
): Promise<{ ok: true; days: number; events: CalendarEvent[] } | { ok: false; error: string }> {
  const days = calendarDays(params.days);
  const query = typeof params.query === 'string' ? params.query.trim().slice(0, 200) : '';
  const url = new URL(CALENDAR);
  url.searchParams.set('timeMin', now.toISOString());
  url.searchParams.set('timeMax', new Date(now.getTime() + days * 86_400_000).toISOString());
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', String(CALENDAR_LIST_MAX));
  if (query) {
    url.searchParams.set('q', query);
  }
  const answer = await googleGet<{ items?: CalendarEvent[] }>(token, url.toString());
  return answer.ok
    ? { ok: true, days, events: (answer.data.items ?? []).filter(e => e.status !== 'cancelled') }
    : { ok: false, error: refusal(answer, 'calendar') };
}

/** The same read, as words. Never throws. */
export async function readCalendar(
  token: string,
  params: Record<string, unknown>,
  now: Date = new Date()
): Promise<Read> {
  const listed = await listCalendarEvents(token, params, now);
  return listed.ok
    ? { ok: true, text: calendarText(listed.events, listed.days) }
    : { ok: false, error: listed.error };
}

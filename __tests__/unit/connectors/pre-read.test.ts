import { describe, expect, it, vi } from 'vitest';
import { OUTSIDE_CONTENT_NOTE } from '@/services/connectors/hands';
import { calendarReach, connectorIntent, preReadForTurn } from '@/services/connectors/pre-read';
import { buildCompanionSystemPrompt } from '@/services/companions/system-prompt';

/**
 * The read happens in code, before the model speaks: whether a calendar is
 * opened when a person asks about their week must not depend on how well
 * the model on duty chooses tools. Seen live on 2026-11-13: "Check my email.
 * What do I have next week / And calendar" came back with nothing read.
 */
describe('what a message plainly asks to have read', () => {
  it('hears the calendar, in the owner’s languages, and how far ahead', () => {
    expect(connectorIntent('What do I have next week')).toEqual({ calendar: { days: 14 } });
    expect(connectorIntent('And calendar')).toEqual({ calendar: { days: 7 } });
    expect(connectorIntent("what's on tomorrow?")).toEqual({ calendar: { days: 2 } });
    expect(connectorIntent('Was steht heute an?')).toEqual({ calendar: { days: 1 } });
    expect(connectorIntent('Welche Termine habe ich diese Woche')).toEqual({
      calendar: { days: 7 },
    });
    expect(calendarReach('anything this month')).toBe(31);
  });

  it('hears the mail, and "unread" as unread', () => {
    expect(connectorIntent('Check my email')).toEqual({
      mail: { query: 'in:inbox newer_than:7d' },
    });
    expect(connectorIntent('any unread e-mails?')).toEqual({
      mail: { query: 'is:unread in:inbox' },
    });
    expect(connectorIntent('Was ist im Posteingang')).toEqual({
      mail: { query: 'in:inbox newer_than:7d' },
    });
  });

  it('hears both in one message', () => {
    expect(connectorIntent('Check my email. What do I have next week')).toEqual({
      calendar: { days: 14 },
      mail: { query: 'in:inbox newer_than:7d' },
    });
  });

  it('hears nothing in a message about something else', () => {
    for (const other of [
      'How much Bitcoin have I received so far?',
      'Write a mailing list signup page',
      'Make an event on Saturday at Rote Fabrik',
      'What can I sell on OrangeCat?',
      'email me when it is done',
    ]) {
      // "email me" is a verb, not the mailbox; a page about mail is not the inbox.
      expect(connectorIntent(other), other).toBeNull();
    }
  });
});

describe('the read itself', () => {
  const calendar = vi.fn(async () => ({ success: true, data: { text: '1 events: Dentist' } }));
  const mail = vi.fn(async () => ({ success: true, data: { text: '2 messages' } }));
  const hands = { calendar_read: calendar, gmail_read: mail };

  it('runs what was asked, as the person, and hands the model the result', async () => {
    const read = await preReadForTurn('u1', 'Check my email. What do I have next week', { hands });
    expect(calendar).toHaveBeenCalledWith('u1', { days: 14 });
    expect(mail).toHaveBeenCalledWith('u1', { query: 'in:inbox newer_than:7d' });
    expect(read?.block).toMatch(/## Read just now, for this message/);
    expect(read?.block).toMatch(/### Their calendar\n1 events: Dentist/);
    expect(read?.block).toMatch(/### Their mail\n2 messages/);
    // What comes from outside is marked as someone else's words.
    expect(read?.block).toContain(OUTSIDE_CONTENT_NOTE);
    expect(read?.evidence).toEqual(['1 events: Dentist', '2 messages']);
  });

  it('reads nothing, and adds nothing, for a message about something else', async () => {
    calendar.mockClear();
    expect(await preReadForTurn('u1', 'What can I sell?', { hands })).toBeNull();
    expect(calendar).not.toHaveBeenCalled();
  });

  it('says why when a read fails, and invents nothing in its place', async () => {
    const failing = {
      calendar_read: async () => ({ success: false, error: 'not switched on for OrangeCat yet' }),
    };
    const read = await preReadForTurn('u1', 'my calendar', { hands: failing });
    expect(read?.block).toMatch(/It could not be read: not switched on for OrangeCat yet/);
    expect(read?.block).not.toContain(OUTSIDE_CONTENT_NOTE);
    expect(read?.evidence).toEqual([]);
  });

  it('leaves out a read that is not allowed here (a hand switched off, an account not connected)', async () => {
    mail.mockClear();
    const read = await preReadForTurn('u1', 'Check my email and my calendar', {
      hands,
      allowed: id => id === 'calendar_read',
    });
    expect(mail).not.toHaveBeenCalled();
    expect(read?.block).not.toMatch(/Their mail/);
    expect(
      await preReadForTurn('u1', 'Check my email', { hands, allowed: () => false })
    ).toBeNull();
  });

  it('survives a hand that throws', async () => {
    const read = await preReadForTurn('u1', 'my calendar', {
      hands: {
        calendar_read: async () => {
          throw new Error('boom');
        },
      },
    });
    expect(read?.block).toMatch(/It could not be read: the read failed just now/);
  });
});

describe('a bot’s prompt', () => {
  it('ends with what was read for this message', () => {
    const prompt = buildCompanionSystemPrompt({
      definition: 'You plan days.',
      memories: [],
      readNow: '## Read just now, for this message\n\n### Their calendar\nDentist',
    });
    expect(prompt?.endsWith('### Their calendar\nDentist')).toBe(true);
  });
});

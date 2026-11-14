import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CAT_ACTIONS } from '@/config/cat-actions';
import { COMPANION_COPY } from '@/config/companions';
import { COMPANION_HANDS } from '@/services/companions/hands';
import { needsReview } from '@/services/companions/rules';
import {
  addCalendarEntry,
  agendaDays,
  agendaText,
  parseWhen,
  readAgenda,
  removeCalendarEntry,
  whenText,
  type Agenda,
} from '@/services/planner/calendar';
import { agendaForPage } from '@/services/planner/calendar-page';
import { PLANNER_HANDS, isPlannerHand } from '@/services/planner/hands';
import { dueInstant, openTasksText, taskListPage } from '@/services/planner/tasks';
import { sectionOf } from '@/app/(authenticated)/dashboard/tasks/components/MyListView';

/**
 * A person's own planner: their to-do list and their calendar, read and
 * written by them, their Cat and their bots. What is pinned: a time with no
 * offset is their wall clock, a row is only ever touched as its owner, and
 * one agenda holds every place they keep their days.
 */

/** Rows in memory with the few calls the planner makes. */
function fakeDb(seed: Record<string, Array<Record<string, unknown>>> = {}) {
  const tables: Record<string, Array<Record<string, unknown>>> = { ...seed };
  let n = 0;
  const from = (name: string) => {
    const rows = (tables[name] ??= []);
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    let op: 'select' | 'insert' | 'delete' = 'select';
    let patch: Record<string, unknown> = {};
    const run = () => {
      if (op === 'insert') {
        n += 1;
        const row = { id: `00000000-0000-4000-8000-00000000000${n}`, ...patch };
        rows.push(row);
        return [row];
      }
      const hit = rows.filter(r => filters.every(f => f(r)));
      if (op === 'delete') {
        hit.forEach(r => rows.splice(rows.indexOf(r), 1));
      }
      return hit;
    };
    const q: Record<string, unknown> = {
      select: () => q,
      order: () => q,
      eq: (k: string, v: unknown) => (filters.push(r => r[k] === v), q),
      gte: (k: string, v: string) => (filters.push(r => String(r[k]) >= v), q),
      lte: (k: string, v: string) => (filters.push(r => String(r[k]) <= v), q),
      insert: (v: Record<string, unknown>) => ((op = 'insert'), (patch = v), q),
      delete: () => ((op = 'delete'), q),
      limit: (count: number) => Promise.resolve({ data: run().slice(0, count), error: null }),
      single: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => unknown) => resolve({ data: run(), error: null }),
    };
    return q;
  };
  return { client: { from } as never, tables };
}

describe('the planner’s hands', () => {
  it('are registered actions that bots hold, each with its own words', () => {
    for (const id of Object.keys(PLANNER_HANDS)) {
      expect(CAT_ACTIONS[id]?.enabled, id).toBe(true);
      expect(COMPANION_HANDS, id).toContain(id);
      expect(COMPANION_COPY.talk.abilities.labels[id], id).toBeTruthy();
      expect(isPlannerHand(id)).toBe(true);
    }
    expect(isPlannerHand('create_event')).toBe(false);
  });

  it('check a write against the owner’s rules, and let a read through', () => {
    expect(needsReview('tasks_read', {})).toBe(false);
    expect(needsReview('calendar_read', {})).toBe(false);
    expect(needsReview('calendar_add', { title: 'x' })).toBe(true);
    expect(needsReview('create_task', { title: 'x' })).toBe(true);
  });
});

describe('a time as a person writes it', () => {
  it('is their wall clock when it carries no offset', () => {
    // Nine in Zürich in November is eight in UTC.
    expect(parseWhen('2026-11-16T09:00', 'Europe/Zurich')).toBe('2026-11-16T08:00:00.000Z');
    expect(parseWhen('2026-11-16 09:00', 'Europe/Zurich')).toBe('2026-11-16T08:00:00.000Z');
    expect(parseWhen('2026-11-16', 'Europe/Zurich')).toBe('2026-11-15T23:00:00.000Z');
  });

  it('is taken as written when it says its own offset', () => {
    expect(parseWhen('2026-11-16T09:00:00+01:00', 'America/New_York')).toBe(
      '2026-11-16T08:00:00.000Z'
    );
    expect(parseWhen('2026-11-16T09:00:00Z', 'Europe/Zurich')).toBe('2026-11-16T09:00:00.000Z');
  });

  it('is nothing when it is not a time', () => {
    expect(parseWhen('sometime', 'Europe/Zurich')).toBeNull();
    expect(parseWhen('', 'Europe/Zurich')).toBeNull();
    expect(parseWhen(undefined, null)).toBeNull();
  });

  it('is shown in their zone, and in labelled UTC when the zone is not known', () => {
    expect(whenText('2026-11-16T08:00:00.000Z', false, 'Europe/Zurich')).toBe('2026-11-16 09:00');
    expect(whenText('2026-11-16T08:00:00.000Z', false, null)).toBe('2026-11-16 08:00 UTC');
    expect(whenText('2026-11-18', true, 'Europe/Zurich')).toBe('2026-11-18 (all day)');
  });
});

describe('a calendar entry', () => {
  it('is written as its owner, with who made it, and answers with its id', async () => {
    const db = fakeDb();
    const out = await addCalendarEntry(
      db.client,
      'u1',
      { title: 'Dentist', start: '2026-11-16T09:00', location: 'Chur' },
      { madeBy: 'bot-7', zone: 'Europe/Zurich' }
    );
    expect(out.success).toBe(true);
    expect(db.tables.calendar_entries[0]).toMatchObject({
      user_id: 'u1',
      title: 'Dentist',
      starts_at: '2026-11-16T08:00:00.000Z',
      all_day: false,
      location: 'Chur',
      made_by: 'bot-7',
    });
    expect((out.data as { displayMessage: string }).displayMessage).toMatch(
      /Added to your calendar: "Dentist" on 2026-11-16 09:00 \[entry_id: /
    );
  });

  it('is all day when only a date is given', async () => {
    const db = fakeDb();
    await addCalendarEntry(db.client, 'u1', { title: 'Holiday', start: '2026-11-18' });
    expect(db.tables.calendar_entries[0].all_day).toBe(true);
  });

  it('needs a title and a time, and cannot end before it starts', async () => {
    const db = fakeDb();
    expect((await addCalendarEntry(db.client, 'u1', { start: '2026-11-16T09:00' })).success).toBe(
      false
    );
    expect(
      (await addCalendarEntry(db.client, 'u1', { title: 'x', start: 'soonish' })).error
    ).toMatch(/needs "start"/);
    expect(
      (
        await addCalendarEntry(db.client, 'u1', {
          title: 'x',
          start: '2026-11-16T09:00',
          end: '2026-11-16T08:00',
        })
      ).error
    ).toMatch(/cannot end before/);
    expect(db.tables.calendar_entries ?? []).toHaveLength(0);
  });

  it('is removed only by its owner', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const db = fakeDb({ calendar_entries: [{ id, user_id: 'u1', title: 'Dentist' }] });
    expect((await removeCalendarEntry(db.client, 'u2', { entry_id: id })).success).toBe(false);
    expect(db.tables.calendar_entries).toHaveLength(1);
    expect((await removeCalendarEntry(db.client, 'u1', { entry_id: 'not-an-id' })).success).toBe(
      false
    );
    const gone = await removeCalendarEntry(db.client, 'u1', { entry_id: id });
    expect(gone.success).toBe(true);
    expect(db.tables.calendar_entries).toHaveLength(0);
  });
});

describe('the agenda', () => {
  const now = new Date('2026-11-16T07:00:00Z');
  const seed = () =>
    fakeDb({
      calendar_entries: [
        {
          id: 'e1',
          user_id: 'u1',
          title: 'Dentist',
          starts_at: '2026-11-16T08:00:00.000Z',
          ends_at: '2026-11-16T08:30:00.000Z',
          all_day: false,
          location: 'Chur',
          made_by: 'me',
        },
        {
          id: 'e2',
          user_id: 'u2',
          title: 'Someone else’s',
          starts_at: '2026-11-16T09:00:00.000Z',
          ends_at: null,
          all_day: false,
          location: null,
          made_by: 'me',
        },
      ],
      tasks: [
        {
          id: 't1',
          created_by: 'u1',
          title: 'Tax form',
          due_date: '2026-11-17T10:00:00.000Z',
          is_reminder: false,
          is_completed: false,
          is_archived: false,
        },
        {
          id: 't2',
          created_by: 'u1',
          title: 'Done already',
          due_date: '2026-11-17T11:00:00.000Z',
          is_reminder: false,
          is_completed: true,
          is_archived: false,
        },
      ],
    });
  const google = async () => ({
    note: null,
    items: [
      {
        source: 'google' as const,
        title: 'Call with Ana',
        start: '2026-11-16T15:00:00+01:00',
        end: '2026-11-16T15:30:00+01:00',
        allDay: false,
        location: null,
      },
    ],
  });

  it('is one list in time order from every place: own entries, what falls due, Google', async () => {
    const agenda = await readAgenda(seed().client, 'u1', 7, now, { google });
    expect(agenda.items.map(i => `${i.source}:${i.title}`)).toEqual([
      'calendar:Dentist',
      'google:Call with Ana',
      'task:Tax form',
    ]);
    const text = agendaText(agenda, 'Europe/Zurich');
    expect(text).toMatch(/^3 in your calendar for the next 7 days \(times in Europe\/Zurich\):/);
    expect(text).toMatch(/- 2026-11-16 09:00 to 09:30 · Dentist · Chur \[entry_id: e1\]/);
    expect(text).toMatch(/- 2026-11-16 15:00 to 15:30 · Call with Ana · Google calendar/);
    expect(text).toMatch(/- 2026-11-17 11:00 · Tax form · task due \[task_id: t1\]/);
    // Nobody else's entry, and nothing already ticked off.
    expect(text).not.toMatch(/Someone else|Done already/);
  });

  it('still answers when Google is not connected or does not answer, and says why', async () => {
    const quiet = await readAgenda(seed().client, 'u1', 7, now, {
      google: async () => ({ items: [], note: null }),
    });
    expect(quiet.items).toHaveLength(2);
    const broken = await readAgenda(seed().client, 'u1', 7, now, {
      google: async () => {
        throw new Error('down');
      },
    });
    expect(broken.items).toHaveLength(2);
    const noted: Agenda = {
      days: 1,
      items: [],
      googleNote: 'Your Google calendar could not be read: x',
    };
    expect(agendaText(noted, null)).toBe(
      'Nothing in your calendar for the next day.\nYour Google calendar could not be read: x'
    );
  });

  it('looks a week ahead unless told, and never more than two months', () => {
    expect(agendaDays(undefined)).toBe(7);
    expect(agendaDays('30')).toBe(30);
    expect(agendaDays(9999)).toBe(62);
  });

  it('is drawn on the page by day, in the person’s clock, with only own entries removable', async () => {
    const page = agendaForPage(
      await readAgenda(seed().client, 'u1', 7, now, { google }),
      'Europe/Zurich'
    );
    expect(page.byDay.map(d => d.day)).toEqual(['2026-11-16', '2026-11-17']);
    expect(page.byDay[0].rows[0]).toMatchObject({
      entryId: 'e1',
      time: '09:00 to 09:30',
      title: 'Dentist',
    });
    expect(page.byDay[0].rows[1]).toMatchObject({ source: 'google', time: '15:00 to 15:30' });
    expect(page.byDay[0].rows[1].entryId).toBeUndefined();
    expect(page.byDay[1].rows[0]).toMatchObject({ source: 'task', time: '11:00' });
  });
});

describe('the to-do list as words', () => {
  it('says what is overdue and carries the id each change needs', () => {
    const text = openTasksText(
      [
        {
          id: 't1',
          title: 'Tax form',
          dueDate: '2026-11-10T10:00:00Z',
          priority: 'high',
          isReminder: false,
        },
        { id: 't2', title: 'Call Ana', dueDate: null, priority: 'normal', isReminder: true },
      ],
      new Date('2026-11-16T00:00:00Z')
    );
    expect(text).toMatch(/^2 open on your to-do list:/);
    expect(text).toMatch(/- Tax form · overdue since 2026-11-10 10:00 UTC · high \[task_id: t1\]/);
    expect(text).toMatch(/- Call Ana \(reminder\) · no date \[task_id: t2\]/);
    expect(openTasksText([])).toBe('Nothing is open on your to-do list.');
  });
});

describe('the calendar table', () => {
  const sql = readFileSync('supabase/migrations/20261114090000_a_calendar_of_your_own.sql', 'utf8');
  it('is private to its owner', () => {
    expect(sql).toContain('ALTER TABLE public.calendar_entries ENABLE ROW LEVEL SECURITY');
    expect(sql).toMatch(/FOR ALL USING \(\(SELECT auth\.uid\(\)\) = user_id\)/);
    expect(sql).toMatch(/WITH CHECK \(\(SELECT auth\.uid\(\)\) = user_id\)/);
    expect(sql).not.toMatch(/TO anon/);
  });
});

describe('the pages’ own shapes', () => {
  it('gives a calendar entry an end from how long it lasts', async () => {
    const db = fakeDb();
    await addCalendarEntry(
      db.client,
      'u1',
      { title: 'Dentist', start: '2026-11-16T09:00', minutes: 30 },
      { zone: 'Europe/Zurich' }
    );
    expect(db.tables.calendar_entries[0]).toMatchObject({
      starts_at: '2026-11-16T08:00:00.000Z',
      ends_at: '2026-11-16T08:30:00.000Z',
    });
  });

  it('stores a task due "that day" at the day’s last minute, in the person’s clock', () => {
    expect(dueInstant('2026-11-16', 'Europe/Zurich')).toBe('2026-11-16T22:59:00.000Z');
    expect(dueInstant('2026-11-16', null)).toBe('2026-11-16T23:59:00.000Z');
    expect(dueInstant('next monday', 'Europe/Zurich')).toBeNull();
  });

  it('lists tasks by the day they are due in the person’s clock, not in UTC', () => {
    const page = taskListPage(
      [
        // 22:59 UTC on the 16th is still the 16th in Zürich.
        {
          id: 't1',
          title: 'A',
          dueDate: '2026-11-16T22:59:00.000Z',
          priority: 'normal',
          isReminder: false,
        },
        // 23:30 UTC on the 16th is already the 17th in Zürich.
        {
          id: 't2',
          title: 'B',
          dueDate: '2026-11-16T23:30:00.000Z',
          priority: 'normal',
          isReminder: false,
        },
        { id: 't3', title: 'C', dueDate: null, priority: 'normal', isReminder: true },
      ],
      'Europe/Zurich',
      new Date('2026-11-14T08:00:00Z')
    );
    expect(page.today).toBe('2026-11-14');
    expect(page.tasks.map(t => t.dueDay)).toEqual(['2026-11-16', '2026-11-17', null]);
  });

  it('sorts a task into late, today, coming up or no date', () => {
    expect(sectionOf({ dueDay: '2026-11-12' }, '2026-11-14')).toBe('late');
    expect(sectionOf({ dueDay: '2026-11-14' }, '2026-11-14')).toBe('today');
    expect(sectionOf({ dueDay: '2026-11-15' }, '2026-11-14')).toBe('soon');
    expect(sectionOf({ dueDay: null }, '2026-11-14')).toBe('someday');
  });

  it('shows a task due that day as all day on the calendar, not at 23:59', () => {
    const page = agendaForPage(
      {
        days: 7,
        googleNote: null,
        items: [
          {
            source: 'task',
            id: 't1',
            title: 'Tax form',
            start: '2026-11-16T22:59:00.000Z',
            allDay: false,
          },
        ],
      },
      'Europe/Zurich',
      new Date('2026-11-14T08:00:00Z')
    );
    expect(page.today).toBe('2026-11-14');
    expect(page.byDay[0]).toMatchObject({ day: '2026-11-16', rows: [{ time: 'All day' }] });
  });
});

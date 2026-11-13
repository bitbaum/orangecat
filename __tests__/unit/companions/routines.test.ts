import { describe, expect, it } from 'vitest';
import {
  deleteRoutine,
  isTimeLocal,
  listRoutines,
  ROUTINE_INTERVALS,
  ROUTINES_PER_BOT,
  RoutineLimitError,
  saveRoutine,
  isRoutineInterval,
  nextRoutineRun,
  nextRunAt,
  routineNotice,
  skipReason,
} from '@/services/companions/routines-store';
import { ownerNoticeBody } from '@/services/loki/notify-owner';

/**
 * A bot that writes first: the next run is the next time of day in the
 * person's zone, strictly after now, and a routine runs only on the
 * person's own key.
 */
describe('nextRunAt', () => {
  it('is today when the time is still ahead, tomorrow when it has passed', () => {
    // 06:00 UTC on 2026-11-02 is 07:00 in Zürich (winter).
    const now = new Date('2026-11-02T06:00:00Z');
    expect(nextRunAt(now, '08:00', 'Europe/Zurich')).toBe('2026-11-02T07:00:00.000Z');
    expect(nextRunAt(now, '07:00', 'Europe/Zurich')).toBe('2026-11-03T06:00:00.000Z');
    expect(nextRunAt(now, '06:30', 'Europe/Zurich')).toBe('2026-11-03T05:30:00.000Z');
  });

  it('reads the time in the zone, not in UTC', () => {
    const now = new Date('2026-11-02T06:00:00Z');
    expect(nextRunAt(now, '08:00', 'America/New_York')).toBe('2026-11-02T13:00:00.000Z');
    expect(nextRunAt(now, '08:00', 'Asia/Tokyo')).toBe('2026-11-02T23:00:00.000Z');
  });

  it('is always after now', () => {
    const now = new Date('2026-03-29T00:30:00Z'); // the night Europe springs forward
    const next = new Date(nextRunAt(now, '02:30', 'Europe/Zurich')).getTime();
    expect(next).toBeGreaterThan(now.getTime());
  });
});

describe('a routine’s rules', () => {
  it('takes a time of day as HH:MM, 24 hours', () => {
    expect(isTimeLocal('08:00')).toBe(true);
    expect(isTimeLocal('23:59')).toBe(true);
    expect(isTimeLocal('24:00')).toBe(false);
    expect(isTimeLocal('8:00')).toBe(false);
    expect(isTimeLocal(800)).toBe(false);
  });

  it('runs only on the person’s own key', () => {
    expect(skipReason(true)).toBeNull();
    expect(skipReason(false)).toBe('needs_own_key');
  });
});

describe('a routine on the owner’s Telegram', () => {
  const notice = routineNotice({
    routineId: 'r1',
    assistantId: 'a1',
    botTitle: 'Day Planner',
    reply: 'Three things today: the tax form, the landlord, Ana’s present.',
    day: '2026-11-02',
  });

  it('is the bot’s words with one tap that opens its chat, silent', () => {
    const body = ownerNoticeBody(notice, 'https://orangecat.ch');
    expect(body.title).toBe('Day Planner');
    expect(body.body).toContain('Three things today');
    expect(body.actions).toEqual([
      { label: 'Open the chat', url: 'https://orangecat.ch/companions/talk?with=a1' },
    ]);
    expect(body.urgency).toBe('today');
    expect(body.actions[0].label.length).toBeLessThanOrEqual(24);
  });

  it('is one message per routine per day', () => {
    expect(notice.key).toBe('routine:r1:2026-11-02');
  });
});

describe('a routine that repeats through the day', () => {
  const now = new Date('2026-11-02T06:10:00.000Z');

  it('runs again that many hours after each run', () => {
    expect(nextRoutineRun(now, { timeLocal: '08:00', zone: 'Europe/Zurich', everyHours: 2 })).toBe(
      '2026-11-02T08:10:00.000Z'
    );
    expect(nextRoutineRun(now, { timeLocal: '08:00', zone: 'Europe/Zurich', everyHours: 1 })).toBe(
      '2026-11-02T07:10:00.000Z'
    );
  });

  it('keeps its hours: the next run steps from when it was due, not when the cron ran it', () => {
    const late = new Date('2026-11-02T08:14:00.000Z');
    expect(
      nextRoutineRun(late, {
        timeLocal: '08:00',
        zone: 'Europe/Zurich',
        everyHours: 2,
        dueAt: '2026-11-02T08:00:00.000Z',
      })
    ).toBe('2026-11-02T10:00:00.000Z');
    // Down for a day: the next run is the first still ahead, not a burst.
    expect(
      nextRoutineRun(late, {
        timeLocal: '08:00',
        zone: 'Europe/Zurich',
        everyHours: 4,
        dueAt: '2026-11-01T06:00:00.000Z',
      })
    ).toBe('2026-11-02T10:00:00.000Z');
  });

  it('is the daily routine when no interval, or one that is not offered, is set', () => {
    const daily = nextRunAt(now, '08:00', 'Europe/Zurich');
    for (const everyHours of [null, undefined, 0, 3, 48]) {
      expect(nextRoutineRun(now, { timeLocal: '08:00', zone: 'Europe/Zurich', everyHours })).toBe(
        daily
      );
    }
    expect(ROUTINE_INTERVALS.every(isRoutineInterval)).toBe(true);
    expect(isRoutineInterval('2')).toBe(false);
  });
});

/**
 * A bot holds several routines. The table is faked as rows in memory with
 * the few calls the store makes, so what is checked is the store's own
 * rules: a new one is added beside the others, an id changes only that one,
 * a sixth is refused, and Stop takes one or all.
 */
describe('several routines per bot', () => {
  type Row = Record<string, unknown> & { id: string };

  function fakeDb(seed: Row[] = []) {
    const rows = [...seed];
    let n = seed.length;
    const from = () => {
      const filters: Array<[string, unknown]> = [];
      let op: 'select' | 'update' | 'delete' | 'insert' = 'select';
      let patch: Record<string, unknown> = {};
      const matches = (r: Row) => filters.every(([k, v]) => r[k] === v);
      const run = () => {
        if (op === 'insert') {
          n += 1;
          const row = { id: `r${n}`, created_at: `2026-11-13T00:00:0${n}Z`, ...patch } as Row;
          rows.push(row);
          return [row];
        }
        const hit = rows.filter(matches);
        if (op === 'update') {
          hit.forEach(r => Object.assign(r, patch));
        }
        if (op === 'delete') {
          hit.forEach(r => rows.splice(rows.indexOf(r), 1));
        }
        return hit;
      };
      const q = {
        select: () => q,
        order: () => q,
        limit: (count: number) => Promise.resolve({ data: run().slice(0, count), error: null }),
        eq: (k: string, v: unknown) => {
          filters.push([k, v]);
          return q;
        },
        insert: (v: Record<string, unknown>) => {
          op = 'insert';
          patch = v;
          return q;
        },
        update: (v: Record<string, unknown>) => {
          op = 'update';
          patch = v;
          return q;
        },
        delete: () => {
          op = 'delete';
          return q;
        },
        single: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
        maybeSingle: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
        then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
          resolve({ data: run(), error: null }),
      };
      return q;
    };
    return { client: { from } as never, rows };
  }

  const input = { prompt: 'Is the site up?', timeLocal: '08:00', zone: 'Europe/Zurich' };

  it('adds a second routine beside the first and lists both, oldest first', async () => {
    const db = fakeDb();
    await saveRoutine(db.client, 'u1', 'bot1', input);
    await saveRoutine(db.client, 'u1', 'bot1', {
      ...input,
      prompt: 'Morning brief',
      everyHours: 4,
    });
    const list = await listRoutines(db.client, 'u1', 'bot1');
    expect(list.map(r => r.prompt)).toEqual(['Is the site up?', 'Morning brief']);
    expect(list[1].everyHours).toBe(4);
  });

  it('changes only the routine it is given', async () => {
    const db = fakeDb();
    const first = await saveRoutine(db.client, 'u1', 'bot1', input);
    await saveRoutine(db.client, 'u1', 'bot1', { ...input, prompt: 'Second' });
    const changed = await saveRoutine(
      db.client,
      'u1',
      'bot1',
      { ...input, timeLocal: '09:30' },
      first?.id
    );
    expect(changed?.timeLocal).toBe('09:30');
    const list = await listRoutines(db.client, 'u1', 'bot1');
    expect(list.map(r => r.timeLocal)).toEqual(['09:30', '08:00']);
    expect(db.rows).toHaveLength(2);
  });

  it('answers null, and changes nothing, for a routine that is someone else’s', async () => {
    const db = fakeDb();
    const mine = await saveRoutine(db.client, 'u1', 'bot1', input);
    expect(await saveRoutine(db.client, 'u2', 'bot1', input, mine?.id)).toBeNull();
    expect(await saveRoutine(db.client, 'u1', 'bot2', input, mine?.id)).toBeNull();
    expect(db.rows).toHaveLength(1);
  });

  it('refuses one more than a bot can hold', async () => {
    const db = fakeDb();
    for (let i = 0; i < ROUTINES_PER_BOT; i++) {
      await saveRoutine(db.client, 'u1', 'bot1', input);
    }
    await expect(saveRoutine(db.client, 'u1', 'bot1', input)).rejects.toBeInstanceOf(
      RoutineLimitError
    );
    // Another bot of the same person starts from none.
    expect(await saveRoutine(db.client, 'u1', 'bot2', input)).not.toBeNull();
  });

  it('stops one routine, or all of the bot’s', async () => {
    const db = fakeDb();
    const first = await saveRoutine(db.client, 'u1', 'bot1', input);
    await saveRoutine(db.client, 'u1', 'bot1', input);
    await saveRoutine(db.client, 'u1', 'bot1', input);
    await saveRoutine(db.client, 'u1', 'bot2', input);
    await deleteRoutine(db.client, 'u1', 'bot1', first?.id);
    expect(await listRoutines(db.client, 'u1', 'bot1')).toHaveLength(2);
    await deleteRoutine(db.client, 'u1', 'bot1');
    expect(await listRoutines(db.client, 'u1', 'bot1')).toHaveLength(0);
    expect(await listRoutines(db.client, 'u1', 'bot2')).toHaveLength(1);
  });
});

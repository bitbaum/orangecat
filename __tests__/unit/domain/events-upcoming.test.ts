/**
 * /events listed nothing until a visitor shared a location. With no point it
 * now lists every upcoming public event: online first, then by date, and an
 * event that is over (the shared eventHasEnded rule) is not offered.
 */
import { listUpcomingEvents } from '@/domain/events/upcoming';
import type { AnySupabaseClient } from '@/lib/supabase/types';

type Op = [string, ...unknown[]];

function client(rows: Array<Record<string, unknown>>) {
  const ops: Op[] = [];
  const b: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'in', 'eq', 'or', 'contains', 'order', 'limit']) {
    b[m] = (...args: unknown[]) => {
      ops.push([m, ...args]);
      return b;
    };
  }
  b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok);
  return { client: b as unknown as AnySupabaseClient, ops };
}

const NOW = new Date('2026-11-13T12:00:00Z');
const row = (over: Record<string, unknown>) => ({
  id: 'e',
  title: 'T',
  start_date: '2026-11-20T19:00:00Z',
  end_date: null,
  is_all_day: false,
  timezone: 'Europe/Zurich',
  status: 'published',
  music_genres: null,
  is_online: false,
  ...over,
});

describe('listUpcomingEvents', () => {
  it('asks for live, non-test events, online first then by date', async () => {
    const { client: c, ops } = client([]);
    await listUpcomingEvents(c, { now: NOW });
    expect(ops).toContainEqual(['in', 'status', ['published', 'open', 'full', 'ongoing']]);
    expect(ops).toContainEqual(['eq', 'is_test', false]);
    expect(ops).toContainEqual(['order', 'is_online', { ascending: false }]);
    expect(ops).toContainEqual(['order', 'start_date', { ascending: true }]);
    expect(ops.some(o => o[0] === 'contains')).toBe(false);
  });

  it('narrows by genre when asked', async () => {
    const { client: c, ops } = client([]);
    await listUpcomingEvents(c, { genre: 'Techno', now: NOW });
    expect(ops).toContainEqual(['contains', 'music_genres', ['Techno']]);
  });

  it('drops an event that is over and marks online ones', async () => {
    const { client: c } = client([
      row({ id: 'past', start_date: '2026-11-12T19:00:00Z' }),
      row({ id: 'online', is_online: true }),
      row({ id: 'soon' }),
    ]);
    const events = await listUpcomingEvents(c, { now: NOW });
    expect(events.map(e => e.id)).toEqual(['online', 'soon']);
    expect(events[0]).toMatchObject({ is_online: true, distance_km: null, music_genres: [] });
  });
});

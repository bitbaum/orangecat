import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/planner/zone', () => ({ plannerZone: async () => 'Europe/Zurich' }));
vi.mock('@/services/cat/permission-service', () => ({
  CatPermissionService: class {
    checkPermission = async () => ({ allowed: true });
  },
}));
const add = vi.fn();
vi.mock('@/services/planner/calendar', async orig => ({
  ...((await orig()) as object),
  addCalendarEntry: (...args: unknown[]) => add(...args),
}));

import { writeCalendarFromChat } from '@/services/planner/chat-write';

/** Saturday 14 Nov 2026, afternoon in Zurich. */
const now = new Date('2026-11-14T14:00:00Z');
const supabase = {} as never;

describe('the Cat writing a calendar entry in code', () => {
  it('has a sentence for the person that does not need a model', async () => {
    add.mockResolvedValueOnce({
      success: true,
      data: { id: 'e1', starts_at: '2026-11-16T08:00:00.000Z' },
    });
    const done = await writeCalendarFromChat(
      supabase,
      'u1',
      'put dentist on Monday at 9 in my calendar',
      null,
      now
    );
    expect(done?.reply).toBe('Added to your calendar: dentist, Monday, November 16 at 9:00 AM.');
    expect(done?.evidence).toContain(done?.reply);
  });

  it('says plainly when the write failed', async () => {
    add.mockResolvedValueOnce({ success: false, error: 'the calendar is full' });
    const done = await writeCalendarFromChat(
      supabase,
      'u1',
      'put dentist on Monday at 9 in my calendar',
      null,
      now
    );
    expect(done?.reply).toBe('I could not add that to your calendar: the calendar is full.');
  });

  it('does nothing for a message that is not such an ask', async () => {
    expect(await writeCalendarFromChat(supabase, 'u1', 'how are you', null, now)).toBeNull();
  });
});

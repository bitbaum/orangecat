import {
  notifyCrewAssigned,
  notifyHostTicketTaken,
  notifyTicketIssued,
} from '@/domain/events/notify';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';
import type { Mock } from 'vitest';

vi.mock('@/services/notifications/dispatcher', () => ({
  NotificationDispatcher: { dispatch: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => {
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn(() => chain);
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    let table = '';
    chain.from = vi.fn((t: string) => {
      table = t;
      return chain;
    });
    chain.maybeSingle = vi.fn(() =>
      Promise.resolve({
        data:
          table === 'profiles'
            ? { name: 'Ana Muster', username: 'ana' }
            : {
                title: 'Electronic Night',
                start_date: '2026-10-09T20:00:00Z',
                timezone: 'Europe/Zurich',
                user_id: 'host',
              },
        error: null,
      })
    );
    return chain;
  },
}));

const sent = () => (NotificationDispatcher.dispatch as Mock).mock.calls.at(-1)?.[0];

describe('event notifications', () => {
  it('tells a guest their ticket is on the event page, on the venue’s clock', async () => {
    await notifyTicketIssued({ eventId: 'e1', userId: 'u1', seats: 2, paid: true });
    expect(sent()).toMatchObject({
      userId: 'u1',
      type: 'ticket',
      title: 'Your ticket: Electronic Night',
      actionUrl: '/events/e1',
    });
    expect(sent().message).toContain('for 2 people — Fri, Oct 9, 10:00 PM');
  });

  it('tells door crew they can check guests in', async () => {
    await notifyCrewAssigned({ eventId: 'e1', userId: 'u2', roleTitle: 'Door', checksIn: true });
    expect(sent()).toMatchObject({
      type: 'crew',
      title: "You're on the crew: Door at Electronic Night",
    });
    expect(sent().message).toContain('You can check guests in');
  });

  it('tells the host a guest is coming, by the name they gave', async () => {
    await notifyHostTicketTaken({ eventId: 'e1', guestName: 'Anna' });
    expect(sent()).toMatchObject({
      userId: 'host',
      type: 'ticket',
      title: 'Anna is coming to Electronic Night',
      actionUrl: '/events/e1',
    });
    expect(sent().message).toContain('door list');
  });

  it('names a signed-in guest by their profile, and never tells the host about themselves', async () => {
    await notifyHostTicketTaken({ eventId: 'e1', userId: 'u3' });
    expect(sent()).toMatchObject({
      userId: 'host',
      title: 'Ana Muster is coming to Electronic Night',
    });
    (NotificationDispatcher.dispatch as Mock).mockClear();
    await notifyHostTicketTaken({ eventId: 'e1', userId: 'host' });
    expect(NotificationDispatcher.dispatch).not.toHaveBeenCalled();
  });
});

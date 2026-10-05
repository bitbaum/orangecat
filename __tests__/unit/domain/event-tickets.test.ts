import {
  TicketError,
  claimFreeTicket,
  checkInTicket,
  getSeatsLeft,
  isLiveTicket,
  ticketCheckInUrl,
} from '@/domain/events/tickets';

const rpcReturning = (data: unknown, error: { message: string; code?: string } | null = null) =>
  ({ rpc: vi.fn().mockResolvedValue({ data, error }) }) as never;

describe('event tickets', () => {
  it('points a ticket QR at the door page with its code', () => {
    expect(ticketCheckInUrl('ev-1', 'abc 123')).toMatch(/\/events\/ev-1\/door\?code=abc%20123$/);
  });

  it('counts only registered and attended tickets as live', () => {
    expect(isLiveTicket({ status: 'registered' })).toBe(true);
    expect(isLiveTicket({ status: 'attended' })).toBe(true);
    expect(isLiveTicket({ status: 'cancelled' })).toBe(false);
    expect(isLiveTicket(null)).toBe(false);
  });

  it.each([
    ['23P01', 'full'],
    ['22023', 'paid'],
    ['P0002', 'closed'],
    ['28000', 'auth'],
    ['XX000', 'failed'],
  ])('maps SQLSTATE %s from claim_free_ticket to "%s"', async (code, expected) => {
    const err = await claimFreeTicket(rpcReturning(null, { message: 'nope', code }), 'ev-1').catch(
      e => e
    );
    expect(err).toBeInstanceOf(TicketError);
    expect(err.code).toBe(expected);
    expect(err.message).toBe('nope');
  });

  it('reads seats left, null meaning no limit', async () => {
    expect(await getSeatsLeft(rpcReturning(3), 'ev-1')).toBe(3);
    expect(await getSeatsLeft(rpcReturning(null), 'ev-1')).toBeNull();
  });

  it('refuses check-in for anyone but the organizer as "forbidden"', async () => {
    const err = await checkInTicket(
      rpcReturning(null, { message: 'Only the organizer can check people in', code: '42501' }),
      'ev-1',
      'code'
    ).catch(e => e);
    expect(err.code).toBe('forbidden');
  });
});

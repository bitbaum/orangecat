import {
  TicketError,
  claimFreeTicket,
  claimGuestTicket,
  getGuestTicket,
  guestTicketPath,
  ticketHolderName,
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

  it('opens a guest ticket at its own page, the code being the key', () => {
    expect(guestTicketPath('ev-1', 'ab cd')).toBe('/events/ev-1/ticket/ab%20cd');
  });

  it('claims a guest ticket with the name, and reports a full event as "full"', async () => {
    const supabase = rpcReturning({ ticket_code: 'c0de' });
    await claimGuestTicket(supabase, 'ev-1', 'Anna');
    expect((supabase as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith(
      'claim_guest_ticket',
      { p_event_id: 'ev-1', p_name: 'Anna' }
    );
    const err = await claimGuestTicket(
      rpcReturning(null, { message: 'This event is full', code: '23P01' }),
      'ev-1',
      'Ben'
    ).catch(e => e);
    expect(err.code).toBe('full');
  });

  it('reads no guest ticket for an unknown code', async () => {
    expect(await getGuestTicket(rpcReturning(null), 'nope')).toBeNull();
  });

  it('names a guest on the door list by the name they gave', () => {
    const names = new Map([['u-1', 'Ada']]);
    expect(ticketHolderName({ user_id: 'u-1', guest_name: null }, id => names.get(id))).toBe('Ada');
    expect(ticketHolderName({ user_id: null, guest_name: 'Anna' }, () => undefined)).toBe(
      'Anna (guest)'
    );
    expect(ticketHolderName({ user_id: 'u-2', guest_name: null }, () => undefined)).toBe('Guest');
  });
});

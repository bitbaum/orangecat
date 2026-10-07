/**
 * POST/DELETE /api/events/[id]/ticket — a guest needs only a name.
 *
 * Signed in, nothing changed: the person's own free ticket, notified. Signed
 * out, the body's name claims a guest ticket and the response names the page
 * that is the ticket; giving it back needs that ticket's code.
 */

const getUser = vi.fn();
const guestLimit = vi.fn();
const writeLimit = vi.fn();
const claimFree = vi.fn();
const claimGuest = vi.fn();
const cancelGuest = vi.fn();
const cancelFree = vi.fn();
const notify = vi.fn();

vi.mock('@/lib/api/authHelpers', () => ({ getAuthenticatedUserId: () => getUser() }));
// next/server is aliased to a stub suite-wide (vitest.config.ts), so the
// response helpers are stood in for, as in the other route tests.
vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: (data: unknown) => ({ status: 200, data }),
  apiError: (message: string, code: string, status: number) => ({ status, message, code }),
  apiRateLimited: () => ({ status: 429 }),
}));
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({}) }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimitGuestTicket: () => guestLimit(),
  rateLimitWriteAsync: () => writeLimit(),
  retryAfterSeconds: () => 60,
}));
vi.mock('@/domain/events/notify', () => ({
  notifyTicketIssued: (...a: unknown[]) => notify(...a),
}));
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/domain/events/tickets', async importOriginal => {
  const real = await importOriginal<typeof import('@/domain/events/tickets')>();
  return {
    ...real,
    claimFreeTicket: (...a: unknown[]) => claimFree(...a),
    claimGuestTicket: (...a: unknown[]) => claimGuest(...a),
    cancelGuestTicket: (...a: unknown[]) => cancelGuest(...a),
    cancelFreeTicket: (...a: unknown[]) => cancelFree(...a),
  };
});

import { POST, DELETE } from '@/app/api/events/[id]/ticket/route';
import { TicketError } from '@/domain/events/tickets';

const ctx = { params: Promise.resolve({ id: 'ev-1' }) };
// The route reads json(), nextUrl and headers; a real NextRequest needs the
// Next runtime, so this is the same stand-in the other route tests use.
const request = (url: string, body?: unknown) =>
  ({
    json: async () => {
      if (body === undefined) {
        throw new SyntaxError('no body');
      }
      return body;
    },
    nextUrl: new URL(url),
    headers: new Headers(),
  }) as never;
const URL_BASE = 'https://orangecat.ch/api/events/ev-1/ticket';
const post = (body?: unknown) => request(URL_BASE, body);

beforeEach(() => {
  vi.clearAllMocks();
  guestLimit.mockResolvedValue({ success: true });
  writeLimit.mockResolvedValue({ success: true });
});

describe('a guest ticket', () => {
  it('needs only a name, and answers with the page that is the ticket', async () => {
    getUser.mockResolvedValue(null);
    claimGuest.mockResolvedValue({ ticket_code: 'c0de', user_id: null, guest_name: 'Anna' });
    const res = (await POST(post({ name: '  Anna ' }), ctx)) as unknown as {
      status: number;
      data: { ticketPath: string };
    };
    expect(res.status).toBe(200);
    expect(claimGuest).toHaveBeenCalledWith(expect.anything(), 'ev-1', 'Anna');
    expect(res.data.ticketPath).toBe('/events/ev-1/ticket/c0de');
    expect(notify).not.toHaveBeenCalled();
  });

  it('refuses a missing or too-long name before touching the database', async () => {
    getUser.mockResolvedValue(null);
    expect((await POST(post({ name: '  ' }), ctx)).status).toBe(400);
    expect((await POST(post({ name: 'x'.repeat(81) }), ctx)).status).toBe(400);
    expect((await POST(post(), ctx)).status).toBe(400);
    expect(claimGuest).not.toHaveBeenCalled();
  });

  it('is rate-limited per visitor', async () => {
    getUser.mockResolvedValue(null);
    guestLimit.mockResolvedValue({ success: false });
    expect((await POST(post({ name: 'Anna' }), ctx)).status).toBe(429);
    expect(claimGuest).not.toHaveBeenCalled();
  });

  it('says a full event is full', async () => {
    getUser.mockResolvedValue(null);
    claimGuest.mockRejectedValue(new TicketError('This event is full', 'full'));
    const res = (await POST(post({ name: 'Anna' }), ctx)) as unknown as {
      status: number;
      message: string;
    };
    expect(res.status).toBe(409);
    expect(res.message).toBe('This event is full');
  });

  it('is given back with its code, and not without one', async () => {
    getUser.mockResolvedValue(null);
    const withCode = request(`${URL_BASE}?code=c0de`);
    expect((await DELETE(withCode, ctx)).status).toBe(200);
    expect(cancelGuest).toHaveBeenCalledWith(expect.anything(), 'c0de');
    const without = request(URL_BASE);
    expect((await DELETE(without, ctx)).status).toBe(401);
  });
});

describe('a signed-in ticket is unchanged', () => {
  it('claims the person’s own ticket and notifies them, ignoring any name', async () => {
    getUser.mockResolvedValue('u-1');
    claimFree.mockResolvedValue({ ticket_code: 'mine', user_id: 'u-1' });
    const res = await POST(post({ name: 'ignored' }), ctx);
    expect(res.status).toBe(200);
    expect(claimGuest).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'ev-1', userId: 'u-1' })
    );
  });

  it('gives back the person’s own ticket', async () => {
    getUser.mockResolvedValue('u-1');
    const req = request(URL_BASE);
    expect((await DELETE(req, ctx)).status).toBe(200);
    expect(cancelFree).toHaveBeenCalled();
    expect(cancelGuest).not.toHaveBeenCalled();
  });
});

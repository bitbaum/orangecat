/**
 * POST /api/events/[id]/ticket/purchase — a paid ticket by name, no account.
 */
const writeLimit = vi.fn();
const recipientLimit = vi.fn();
const initiate = vi.fn();

vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: (data: unknown, opts?: { status?: number }) => ({
    status: opts?.status ?? 200,
    data,
  }),
  apiError: (message: string, code: string, status: number) => ({ status, message, code }),
  apiBadRequest: (message: string) => ({ status: 400, message }),
  apiInternalError: (message: string) => ({ status: 500, message }),
  apiRateLimited: () => ({ status: 429 }),
}));
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({}) }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: () => writeLimit(),
  rateLimitPaymentRecipient: (...a: unknown[]) => recipientLimit(...a),
  retryAfterSeconds: () => 60,
}));
vi.mock('@/lib/client-ip', () => ({ clientIpKey: () => 'ip' }));
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/domain/payments/guestTicketPurchase', async importOriginal => ({
  ...(await importOriginal<typeof import('@/domain/payments/guestTicketPurchase')>()),
  initiateGuestTicketPurchase: (...a: unknown[]) => initiate(...a),
}));

import { POST } from '@/app/api/events/[id]/ticket/purchase/route';
import { GuestTicketPurchaseError } from '@/domain/payments/guestTicketPurchase';

const ctx = { params: Promise.resolve({ id: 'ev-1' }) };
const post = (body?: unknown) =>
  ({
    json: async () => {
      if (body === undefined) {
        throw new SyntaxError('no body');
      }
      return body;
    },
    headers: new Headers(),
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  writeLimit.mockResolvedValue({ success: true });
  recipientLimit.mockResolvedValue({ success: true });
  initiate.mockResolvedValue({ status_token: 't', payment_intent: { id: 'pi-1' } });
});

describe('buying a ticket without an account', () => {
  it('mints the invoice for the name given', async () => {
    const res = (await POST(post({ name: 'Ana' }), ctx)) as unknown as { status: number };
    expect(res.status).toBe(201);
    expect(initiate).toHaveBeenCalledWith({}, { eventId: 'ev-1', name: 'Ana' });
    expect(recipientLimit).toHaveBeenCalledWith('event', 'ev-1');
  });

  it('needs a name', async () => {
    const res = (await POST(post({}), ctx)) as unknown as { status: number };
    expect(res.status).toBe(400);
    expect(initiate).not.toHaveBeenCalled();
  });

  it('is rate limited per caller and per event, before any invoice exists', async () => {
    writeLimit.mockResolvedValue({ success: false });
    expect(((await POST(post({ name: 'Ana' }), ctx)) as unknown as { status: number }).status).toBe(
      429
    );
    writeLimit.mockResolvedValue({ success: true });
    recipientLimit.mockResolvedValue({ success: false });
    expect(((await POST(post({ name: 'Ana' }), ctx)) as unknown as { status: number }).status).toBe(
      429
    );
    expect(initiate).not.toHaveBeenCalled();
  });

  it('passes on what the guest can act on, with its status', async () => {
    initiate.mockRejectedValue(new GuestTicketPurchaseError('This event is sold out', 409));
    const res = (await POST(post({ name: 'Ana' }), ctx)) as unknown as {
      status: number;
      message: string;
    };
    expect(res).toMatchObject({ status: 409, message: 'This event is sold out' });
  });

  it('hides anything else', async () => {
    initiate.mockRejectedValue(new Error('connection refused at 10.0.0.3'));
    const res = (await POST(post({ name: 'Ana' }), ctx)) as unknown as {
      status: number;
      message: string;
    };
    expect(res.status).toBe(500);
    expect(res.message).not.toContain('10.0.0.3');
  });
});

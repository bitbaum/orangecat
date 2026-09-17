/**
 * Payment reconciliation sweep — the backstop that makes OrangeCat's record of
 * money converge with reality when nobody's browser is open.
 *
 * What matters here is not "does it call an API" but the selection and safety
 * rules: it must be authenticated, must ask the SAME detection path the browser
 * uses, must stamp intents before asking (so a hanging rail can't block the
 * queue forever), and must survive one rail failing.
 */

import { GET } from '@/app/api/cron/payment-reconcile/route';
import { reconcilePaymentIntent } from '@/domain/payments/paymentFlowService';
import { STATUS } from '@/config/database-constants';

import type { MockedFunction } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
// The response helpers wrap NextResponse, which needs the Next runtime; the
// established convention in route tests is to stub them (see projects-id-api).
vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: vi.fn((data: unknown) => ({
    status: 200,
    json: async () => ({ success: true, data }),
  })),
  apiUnauthorized: vi.fn(() => ({
    status: 401,
    json: async () => ({ success: false }),
  })),
  apiInternalError: vi.fn(() => ({
    status: 500,
    json: async () => ({ success: false }),
  })),
}));
vi.mock('@/domain/payments/paymentFlowService', () => ({
  reconcilePaymentIntent: vi.fn(),
}));

const candidates: Array<Record<string, unknown>> = [];
const polled: string[] = [];
const orFilters: string[] = [];

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => ({
    from: () => {
      const builder: Record<string, unknown> = {};
      // The sweep now runs TWO queries against payment_intents, and they use
      // `eq` for opposite purposes: the stamp is `update().eq(id)` and RESOLVES,
      // the incomplete-settlement check is `select().eq().is().lt()` and must
      // keep CHAINING. One `eq` that always resolved made the second query blow
      // up mid-chain and push 'paid' into `polled`, so this fixture tracks
      // which shape it is in.
      let isUpdate = false;
      let isIncompleteCheck = false;
      for (const m of ['select', 'in', 'order']) {
        builder[m] = vi.fn(() => builder);
      }
      builder.or = vi.fn((filter: string) => {
        orFilters.push(filter);
        return builder;
      });
      builder.is = vi.fn(() => {
        isIncompleteCheck = true;
        return builder;
      });
      builder.lt = vi.fn(() => builder);
      // Nothing half-settled in these fixtures: the incomplete check finds none,
      // so the assertions below stay about reconciliation.
      builder.limit = vi.fn(() =>
        Promise.resolve({ data: isIncompleteCheck ? [] : candidates, error: null })
      );
      builder.update = vi.fn(() => {
        isUpdate = true;
        return builder;
      });
      builder.eq = vi.fn((_col: string, id: string) => {
        if (!isUpdate) {
          return builder;
        }
        polled.push(id);
        return Promise.resolve({ error: null });
      });
      return builder;
    },
  }),
}));

const reconcileMock = reconcilePaymentIntent as MockedFunction<typeof reconcilePaymentIntent>;

/**
 * The jest env has no global web Request; the route only reads the
 * authorization header, so a minimal stub keeps this test env-free (same
 * approach as cronAuth.test.ts).
 */
function request(secret: string | null = 'right-secret'): Request {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'authorization' && secret !== null ? `Bearer ${secret}` : null,
    },
  } as unknown as Request;
}

async function body(res: unknown) {
  return await (res as { json: () => Promise<{ data?: Record<string, number> }> }).json();
}

beforeEach(() => {
  vi.clearAllMocks();
  candidates.length = 0;
  polled.length = 0;
  orFilters.length = 0;
  process.env.CRON_SECRET = 'right-secret';
  reconcileMock.mockResolvedValue({ status: STATUS.PAYMENT_INTENTS.INVOICE_READY, paid_at: null });
});

describe('payment reconciliation sweep', () => {
  it('rejects an unauthenticated caller', async () => {
    const res = await GET(request(null));
    expect((res as unknown as { status: number }).status).toBe(401);
    expect(reconcileMock).not.toHaveBeenCalled();
  });

  it('rejects a wrong secret', async () => {
    const res = await GET(request('wrong'));
    expect((res as unknown as { status: number }).status).toBe(401);
  });

  it('keeps watching on-chain intents, bounded by a horizon instead of a fake expiry', async () => {
    await GET(request());

    expect(orFilters).toHaveLength(1);
    const filter = orFilters[0];

    // On-chain is swept — it never reaches a terminal status, so the sweep is
    // the only thing that will ever notice a late confirmation.
    expect(filter).toContain('payment_method.eq.onchain');

    // ...but not forever: the clause carries a created_at cutoff, so abandoned
    // QRs stop costing mempool.space calls without the record ever claiming
    // that no money arrived.
    const cutoff = filter.match(/onchain[^)]*created_at\.gte\.([^,)]+)/)?.[1];
    expect(cutoff).toBeDefined();

    const ageDays = (Date.now() - new Date(cutoff as string).getTime()) / 86_400_000;
    expect(ageDays).toBeGreaterThan(29);
    expect(ageDays).toBeLessThan(31);
  });

  it('sweeps stale undetectable Lightning intents only after the buyer-claim window closes', async () => {
    await GET(request());
    const filter = orFilters[0];

    // Bare Lightning addresses are undetectable, so "expired" is only a fact
    // once the invoice is dead AND the claim window has closed. The cutoff must
    // trail expiry by the grace period — sweeping at expires_at would refuse a
    // buyer's still-valid "I've paid" claim.
    const cutoff = filter.match(
      /lightning_address,lnurl_verify_url\.is\.null,expires_at\.lt\.([^,)]+)/
    )?.[1];
    expect(cutoff).toBeDefined();

    const ageHours = (Date.now() - new Date(cutoff as string).getTime()) / 3_600_000;
    expect(ageHours).toBeGreaterThan(47);
    expect(ageHours).toBeLessThan(49);
  });

  it('no-ops cleanly when nothing is pending', async () => {
    const res = await GET(request());
    expect((await body(res)).data).toMatchObject({ scanned: 0, settled: 0 });
    expect(reconcileMock).not.toHaveBeenCalled();
  });

  it('counts a payment that settled with nobody watching', async () => {
    candidates.push({ id: 'pi-1', payment_method: 'lightning_address' });
    reconcileMock.mockResolvedValue({
      status: STATUS.PAYMENT_INTENTS.PAID,
      paid_at: new Date().toISOString(),
    });

    const res = await GET(request());

    expect(reconcileMock).toHaveBeenCalledTimes(1);
    expect((await body(res)).data).toMatchObject({ scanned: 1, settled: 1 });
  });

  it('stamps an intent BEFORE asking, so a hanging rail cannot block the queue', async () => {
    candidates.push({ id: 'pi-slow', payment_method: 'nwc' });
    reconcileMock.mockImplementation(async () => {
      // By the time the rail is asked, the stamp must already be written.
      expect(polled).toContain('pi-slow');
      return { status: STATUS.PAYMENT_INTENTS.INVOICE_READY, paid_at: null };
    });

    await GET(request());
    expect(reconcileMock).toHaveBeenCalledTimes(1);
  });

  it('keeps sweeping when one rail throws', async () => {
    candidates.push(
      { id: 'pi-bad', payment_method: 'nwc' },
      { id: 'pi-good', payment_method: 'nwc' }
    );
    reconcileMock.mockRejectedValueOnce(new Error('provider down')).mockResolvedValueOnce({
      status: STATUS.PAYMENT_INTENTS.PAID,
      paid_at: new Date().toISOString(),
    });

    const res = await GET(request());

    expect(reconcileMock).toHaveBeenCalledTimes(2);
    expect((await body(res)).data).toMatchObject({ scanned: 2, settled: 1 });
  });
});

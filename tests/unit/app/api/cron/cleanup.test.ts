/**
 * GET /api/cron/cleanup — handler-level branch tests.
 *
 * A systemd timer runs this daily at 02:00 UTC. Silent failures here mean
 * idempotency_results + webhook_deliveries (delivered rows) grow
 * unbounded — invisible until someone notices the deliveries drawer
 * takes ages to render or pg_stat_activity flags table bloat.
 *
 * The route fans out to two tasks (pruneExpiredIdempotencyResults +
 * pruneDeliveredWebhookDeliveries). Each is independent — one
 * failing doesn't stop the other — and the response summarises per
 * task so server logs are diagnosable.
 *
 * Created: 2026-06-04
 */

const adminDeleteResult: {
  count: number | null;
  error: { message: string } | null;
} = {
  count: 0,
  error: null,
};

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      delete: () => ({
        lt: () => Promise.resolve(adminDeleteResult),
      }),
    }),
  }),
}));

vi.mock('@/services/webhooks/deliveryService', () => ({
  pruneDeliveredWebhookDeliveries: vi.fn(),
}));

vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: vi.fn((payload: unknown) => ({ ok: true, data: payload, status: 200 })),
  apiError: vi.fn((msg: string, code: string, status: number) => ({
    ok: false,
    error: msg,
    code,
    status,
  })),
  apiUnauthorized: vi.fn(() => ({ ok: false, error: 'Unauthorized', status: 401 })),
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { GET } from '@/app/api/cron/cleanup/route';
import { pruneDeliveredWebhookDeliveries } from '@/services/webhooks/deliveryService';
import { apiSuccess, apiUnauthorized } from '@/lib/api/standardResponse';

import type { Mock } from 'vitest';

const CRON_SECRET = 'test-cron-secret';

// jsdom doesn't expose the global Request constructor. The handler
// only touches `request.headers.get('authorization')`; a minimal shim
// keeps the tests env-independent.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeRequest(authHeader: string | null): any {
  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === 'authorization' ? authHeader : null),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  adminDeleteResult.count = 0;
  adminDeleteResult.error = null;
});

afterAll(() => {
  delete process.env.CRON_SECRET;
});

describe('GET /api/cron/cleanup', () => {
  describe('auth', () => {
    it('returns 401 when no authorization header is present', async () => {
      const res = (await GET(makeRequest(null))) as { status: number };
      expect(res.status).toBe(401);
      expect(apiUnauthorized).toHaveBeenCalled();
      expect(pruneDeliveredWebhookDeliveries).not.toHaveBeenCalled();
    });

    it('returns 401 when the secret does not match CRON_SECRET', async () => {
      const res = (await GET(makeRequest('Bearer wrong-secret'))) as { status: number };
      expect(res.status).toBe(401);
      expect(pruneDeliveredWebhookDeliveries).not.toHaveBeenCalled();
    });

    it('returns 401 when the header is well-formed but missing Bearer prefix', async () => {
      const res = (await GET(makeRequest(CRON_SECRET))) as { status: number };
      expect(res.status).toBe(401);
    });
  });

  describe('happy path', () => {
    it('runs both tasks and returns per-task deleted counts', async () => {
      adminDeleteResult.count = 42;
      (pruneDeliveredWebhookDeliveries as Mock).mockResolvedValue(7);

      const res = (await GET(makeRequest(`Bearer ${CRON_SECRET}`))) as {
        ok: boolean;
        data: { ranAt: string; tasks: Record<string, number | string> };
      };

      expect(res.ok).toBe(true);
      expect(res.data.tasks).toEqual({
        idempotency_results: 42,
        webhook_deliveries_delivered: 7,
      });
      expect(typeof res.data.ranAt).toBe('string');
      expect(pruneDeliveredWebhookDeliveries).toHaveBeenCalledTimes(1);
      expect(apiSuccess).toHaveBeenCalled();
    });

    it('reports 0 when neither task pruned anything', async () => {
      adminDeleteResult.count = 0;
      (pruneDeliveredWebhookDeliveries as Mock).mockResolvedValue(0);

      const res = (await GET(makeRequest(`Bearer ${CRON_SECRET}`))) as {
        data: { tasks: Record<string, number | string> };
      };

      expect(res.data.tasks).toEqual({
        idempotency_results: 0,
        webhook_deliveries_delivered: 0,
      });
    });

    it('handles null count from idempotency delete (returns 0)', async () => {
      adminDeleteResult.count = null;
      (pruneDeliveredWebhookDeliveries as Mock).mockResolvedValue(3);

      const res = (await GET(makeRequest(`Bearer ${CRON_SECRET}`))) as {
        data: { tasks: Record<string, number | string> };
      };

      expect(res.data.tasks.idempotency_results).toBe(0);
      expect(res.data.tasks.webhook_deliveries_delivered).toBe(3);
    });
  });

  describe('partial failure (one task fails, the other continues)', () => {
    it('reports the idempotency error string and keeps the webhook count', async () => {
      adminDeleteResult.error = { message: 'connection_reset' };
      (pruneDeliveredWebhookDeliveries as Mock).mockResolvedValue(5);

      const res = (await GET(makeRequest(`Bearer ${CRON_SECRET}`))) as {
        ok: boolean;
        data: { tasks: Record<string, number | string> };
      };

      // Partial failure still returns 200 — the contract is "summarise
      // per task" not "fail the whole run on any error".
      expect(res.ok).toBe(true);
      expect(res.data.tasks.idempotency_results).toBe('error: connection_reset');
      expect(res.data.tasks.webhook_deliveries_delivered).toBe(5);
    });

    it('reports the webhook error string and keeps the idempotency count', async () => {
      adminDeleteResult.count = 11;
      (pruneDeliveredWebhookDeliveries as Mock).mockRejectedValue(new Error('table_lock'));

      const res = (await GET(makeRequest(`Bearer ${CRON_SECRET}`))) as {
        ok: boolean;
        data: { tasks: Record<string, number | string> };
      };

      expect(res.ok).toBe(true);
      expect(res.data.tasks.idempotency_results).toBe(11);
      expect(res.data.tasks.webhook_deliveries_delivered).toBe('error: table_lock');
    });

    it('handles non-Error rejections from the webhook task (String(error))', async () => {
      // Non-Error rejections happen in practice when underlying SDKs
      // throw raw strings or undefined.
      (pruneDeliveredWebhookDeliveries as Mock).mockRejectedValue('weird');

      const res = (await GET(makeRequest(`Bearer ${CRON_SECRET}`))) as {
        data: { tasks: Record<string, number | string> };
      };

      expect(res.data.tasks.webhook_deliveries_delivered).toBe('error: weird');
    });
  });
});

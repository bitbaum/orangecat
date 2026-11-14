/**
 * "Claim orangecat.ch/pay/your-name": the name is checked before the visitor
 * signs up for it. Taken means somebody has it, had it, or it is reserved.
 */
const { limit, lookup } = vi.hoisted(() => ({ limit: vi.fn(), lookup: vi.fn() }));

vi.mock('@/lib/rate-limit', () => ({ rateLimit: limit, retryAfterSeconds: () => 60 }));
vi.mock('@/domain/lightning-address/lnurl-service', () => ({ resolveLnurlRecipient: lookup }));
vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: (data: unknown) => ({ status: 200, data }),
  apiRateLimited: () => ({ status: 429 }),
  apiInternalError: () => ({ status: 500 }),
}));

import { GET } from '@/app/api/pay/name/route';

type Reply = { status: number; data?: { status: string } };

const ask = async (name: string) =>
  (await GET({
    nextUrl: new URL(`https://orangecat.ch/api/pay/name?name=${encodeURIComponent(name)}`),
  } as never)) as unknown as Reply;

describe('GET /api/pay/name', () => {
  beforeEach(() => {
    limit.mockReset().mockResolvedValue({ success: true });
    lookup.mockReset().mockResolvedValue(null);
  });

  it('says a free name is available', async () => {
    expect((await ask('sourdough-anna')).data?.status).toBe('available');
    expect(lookup).toHaveBeenCalledWith('sourdough-anna');
  });

  it('says a name somebody holds is taken', async () => {
    lookup.mockResolvedValue({ userId: 'u1', username: 'anna' });
    expect((await ask('anna')).data?.status).toBe('taken');
  });

  it('treats a reserved name as taken and a malformed one as invalid, without a lookup', async () => {
    expect((await ask('admin')).data?.status).toBe('taken');
    expect((await ask('a b')).data?.status).toBe('invalid');
    expect((await ask('')).data?.status).toBe('invalid');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('is rate-limited per visitor', async () => {
    limit.mockResolvedValue({ success: false });
    expect((await ask('anna')).status).toBe(429);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('does not call a name free when the lookup failed', async () => {
    lookup.mockRejectedValue(new Error('db down'));
    expect((await ask('anna')).status).toBe(500);
  });
});

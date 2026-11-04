import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GET, PATCH } from '@/app/api/cat/offerings/route';
import { getOwnOfferings, setOwnOfferingsSharing } from '@/domain/profile/offerings';
vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: (data: unknown) => Response.json({ success: true, data }),
  apiBadRequest: (message: string) => Response.json({ message }, { status: 400 }),
  apiRateLimited: () => Response.json({}, { status: 429 }),
  handleApiError: () => Response.json({}, { status: 500 }),
}));
vi.mock('@/lib/api/withAuth', () => ({ withAuth: (handler: unknown) => handler }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: vi.fn(async () => ({ success: true })),
  retryAfterSeconds: () => 60,
}));
vi.mock('@/domain/profile/offerings', () => ({
  getOwnOfferings: vi.fn(),
  setOwnOfferingsSharing: vi.fn(),
}));
const client = {};
const request = (body: unknown) =>
  ({ user: { id: 'signed-in-owner' }, supabase: client, json: async () => body }) as never;
beforeEach(() => {
  vi.clearAllMocks();
});
describe('offerings sharing route', () => {
  it('reads only the authenticated owner', async () => {
    vi.mocked(getOwnOfferings).mockResolvedValue({
      enabled: false,
      offerings: { skills: [], assets: [], askedFor: [], notAvailableFor: [] },
    });
    expect((await GET(request(null))).status).toBe(200);
    expect(getOwnOfferings).toHaveBeenCalledWith(client, 'signed-in-owner');
  });
  it.each([{ enabled: true, userId: 'other-user' }, { enabled: 'true' }, {}])(
    'rejects a forged owner or non-boolean decision: %j',
    async body => {
      expect((await PATCH(request(body))).status).toBe(400);
      expect(setOwnOfferingsSharing).not.toHaveBeenCalled();
    }
  );
  it('uses the authenticated owner for a deliberate sharing decision', async () => {
    vi.mocked(setOwnOfferingsSharing).mockResolvedValue({
      enabled: false,
      offerings: { skills: [], assets: [], askedFor: [], notAvailableFor: [] },
    });
    expect((await PATCH(request({ enabled: false }))).status).toBe(200);
    expect(setOwnOfferingsSharing).toHaveBeenCalledWith(client, 'signed-in-owner', false);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { GET, PATCH } from '@/app/api/cat/offerings/route';
// Keep the real standard response helper: shorthand policy names can otherwise
// look correct in route mocks while producing an invalid Cache-Control header.
vi.mock('next/server', () => ({
  NextResponse: { json: (data: unknown, options: ResponseInit) => Response.json(data, options) },
}));
vi.mock('@/lib/api/withAuth', () => ({ withAuth: (handler: unknown) => handler }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: async () => ({ success: true }),
  retryAfterSeconds: () => 60,
}));
vi.mock('@/domain/profile/offerings', () => ({
  getOwnOfferings: async () => ({ enabled: false, offerings: {} }),
  setOwnOfferingsSharing: async () => ({ enabled: true, offerings: {} }),
}));
const request = {
  user: { id: 'owner' },
  supabase: {},
  json: async () => ({ enabled: true }),
} as never;
describe('owned offerings responses cannot be cached', () => {
  it.each([GET, PATCH])('sends a real no-store directive', async handler => {
    const response = await handler(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
});

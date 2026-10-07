/**
 * GET /api/events/[id]/calendar — the .ics behind "Add to calendar".
 * Only an event anyone may see; a draft is not handed out by its id.
 */

const maybeSingle = vi.fn();
const inFilter = vi.fn();

vi.mock('@/lib/api/standardResponse', () => ({
  apiError: (message: string, code: string, status: number) => ({ status, message, code }),
  apiNotFound: (message: string) => ({ status: 404, message }),
  apiRateLimited: () => ({ status: 429 }),
}));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: async () => ({ success: true }),
  retryAfterSeconds: () => 60,
}));
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          in: (...a: unknown[]) => {
            inFilter(...a);
            return { maybeSingle };
          },
        }),
      }),
    }),
  }),
}));

import { GET } from '@/app/api/events/[id]/calendar/route';
import { EVENT_PUBLIC_STATUSES } from '@/config/events';

const ID = '7b0c1c1e-6a7a-4a43-9a43-3f1d4c5b6a7b';
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const request = {} as never;

beforeEach(() => vi.clearAllMocks());

describe('the calendar file', () => {
  it('is an .ics for a public event', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: ID,
        title: 'Rooftop',
        start_date: '2026-11-21T21:00:00Z',
        end_date: null,
        is_all_day: false,
        timezone: 'Europe/Zurich',
        venue_name: 'Espresso Bar',
        venue_address: 'Langstrasse 1',
        venue_city: 'Zurich',
      },
    });
    const res = (await GET(request, ctx(ID))) as Response;
    expect(res.headers.get('Content-Type')).toContain('text/calendar');
    const body = await res.text();
    expect(body).toContain('SUMMARY:Rooftop');
    expect(body).toContain('LOCATION:Espresso Bar\\, Langstrasse 1\\, Zurich');
    expect(body).toContain(`/events/${ID}`);
    expect(inFilter).toHaveBeenCalledWith('status', [...EVENT_PUBLIC_STATUSES]);
  });

  it('is not found for a draft, a missing event or a malformed id', async () => {
    maybeSingle.mockResolvedValue({ data: null });
    expect(((await GET(request, ctx(ID))) as { status: number }).status).toBe(404);
    expect(((await GET(request, ctx('nope'))) as { status: number }).status).toBe(404);
  });
});

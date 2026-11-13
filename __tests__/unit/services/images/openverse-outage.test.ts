/**
 * media#3: an Openverse outage read as "No images found. Try a different
 * search term." The service returned [] for an error status, a timeout and a
 * network failure alike, and the picker could not tell them from a real empty.
 *
 * These pin the split: [] means Openverse answered with nothing; a failure to
 * answer is `ImageSearchUnavailableError`, which the route turns into a 503
 * with words that name the way on.
 */
import { POST } from '@/app/api/ai/images/suggest/route';
import { IMAGE_SEARCH_DOWN_MESSAGE } from '@/config/images';
import { ImageSearchUnavailableError, searchOpenverse } from '@/services/images/openverse';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/api/withAuth', () => ({
  withAuth:
    (handler: (req: unknown) => Promise<unknown>) =>
    (req: unknown): Promise<unknown> =>
      handler(Object.assign(req as object, { user: { id: 'u1' }, supabase: {} })),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: async () => ({ success: true }),
  createRateLimitResponse: () => ({ status: 429 }),
}));

vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: (data: unknown) => ({ status: 200, data }),
  apiBadRequest: (error: string) => ({ status: 400, error }),
  apiInternalError: (error: string) => ({ status: 500, error }),
  apiServiceUnavailable: (error: string) => ({ status: 503, code: 'SERVICE_UNAVAILABLE', error }),
}));

vi.mock('@/services/images/image-suggest', () => ({
  suggestImageQueries: async () => ['rain'],
}));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function answer(status: number, body: unknown): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
}

const ONE_RESULT = {
  results: [{ id: 'a', url: 'https://x/a.jpg', thumbnail: 'https://x/a_t.jpg', title: 'Rain' }],
};

describe('searchOpenverse', () => {
  it('returns [] only when Openverse answered with no matches', async () => {
    fetchMock.mockResolvedValue(answer(200, { results: [] }));
    await expect(searchOpenverse('rain')).resolves.toEqual([]);
  });

  it('maps a real answer', async () => {
    fetchMock.mockResolvedValue(answer(200, ONE_RESULT));
    const images = await searchOpenverse('rain');
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ id: 'a', fullUrl: 'https://x/a.jpg' });
  });

  it('throws "unavailable" for an error status (the 504 measured on 2026-11-13)', async () => {
    fetchMock.mockResolvedValue(answer(504, 'error code: 504'));
    await expect(searchOpenverse('rain')).rejects.toBeInstanceOf(ImageSearchUnavailableError);
  });

  it('throws "unavailable" when the request never answers', async () => {
    fetchMock.mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
    await expect(searchOpenverse('rain')).rejects.toBeInstanceOf(ImageSearchUnavailableError);
  });

  it('bounds the wait with a timeout signal', async () => {
    fetchMock.mockResolvedValue(answer(200, { results: [] }));
    await searchOpenverse('rain');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('POST /api/ai/images/suggest', () => {
  const req = (body: unknown) => ({ json: async () => body }) as never;

  it('answers 503 with the way-on message when the photo service is down', async () => {
    fetchMock.mockResolvedValue(answer(504, 'error code: 504'));
    const res = (await POST(req({ query: 'rain' }))) as unknown as {
      status: number;
      error: string;
    };
    expect(res.status).toBe(503);
    expect(res.error).toBe(IMAGE_SEARCH_DOWN_MESSAGE);
    expect(res.error).toMatch(/upload your own/i);
  });

  it('still answers 200 with an empty list when nothing matched', async () => {
    fetchMock.mockResolvedValue(answer(200, { results: [] }));
    const res = (await POST(req({ query: 'rain' }))) as unknown as {
      status: number;
      data: { images: unknown[] };
    };
    expect(res.status).toBe(200);
    expect(res.data.images).toEqual([]);
  });
});

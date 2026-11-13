/**
 * /roadmap is prerendered and reads the open-capital rails from the database.
 * A database that does not answer must drop the capital card for that render,
 * never fail the build (Next gives a prerendered page 60 s, three times). On
 * 2026-11-12 the build died on /roadmap exactly this way.
 */

const warn = vi.fn();
vi.mock('@/utils/logger', () => ({
  logger: { warn: (...args: unknown[]) => warn(...args), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/development/records', () => ({
  FLEET_PROFILE_URL: 'https://loki.example/orangecat',
  loadOrangeCatProfile: async () => null,
}));

let capital: () => Promise<unknown> = () => new Promise(() => {});
vi.mock('@/services/capital/open-capital', () => ({
  loadOpenCapital: () => capital(),
}));

import RoadmapPage from '@/app/(public)/roadmap/page';

describe('/roadmap does not wait on a database that does not answer', () => {
  beforeEach(() => {
    warn.mockClear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without the capital card once the budget runs out', async () => {
    capital = () => new Promise(() => {});
    let done = false;
    const page = RoadmapPage().then(el => {
      done = true;
      return el;
    });

    await vi.advanceTimersByTimeAsync(14_000);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(await page).toBeTruthy();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('capital not read'),
      expect.anything(),
      'Roadmap'
    );
  });

  it('a database that answers is waited for, with nothing logged', async () => {
    capital = async () => null;
    expect(await RoadmapPage()).toBeTruthy();
    expect(warn).not.toHaveBeenCalled();
  });
});

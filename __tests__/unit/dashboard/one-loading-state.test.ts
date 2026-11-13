/**
 * /dashboard used to show three loading states in a row on a phone: a skeleton
 * of a stats grid the page no longer has (loading.tsx), then a full-screen
 * spinner (page.tsx), then the page — CLS 0.378. Now the route and the page
 * draw one skeleton of the real column, and the setup card's place is held
 * only when the card is expected.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expectSetupCard, rememberSetupCard } from '@/components/dashboard/setup-card-memory';

const dashboardDir = join(process.cwd(), 'src/app/(authenticated)/dashboard');
const read = (file: string) => readFileSync(join(dashboardDir, file), 'utf8');

describe('dashboard loading', () => {
  it('the route skeleton is the dashboard skeleton, not a stats grid', () => {
    const loading = read('loading.tsx');
    expect(loading).toContain('DashboardSkeleton');
    expect(loading).not.toContain('DashboardStatSkeleton');
  });

  it('the page draws the same skeleton and no full-screen spinner', () => {
    const page = read('page.tsx');
    expect(page).toContain('<DashboardSkeleton />');
    expect(page).not.toMatch(/fullScreen/);
  });
});

describe('setup card memory', () => {
  const store = new Map<string, string>();
  beforeAll(() => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
  });
  afterAll(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('expects the card for an account it has not seen', () => {
    expect(expectSetupCard('new-user')).toBe(true);
    expect(expectSetupCard(undefined)).toBe(true);
  });

  it('remembers a finished setup, so nothing is reserved next time', () => {
    rememberSetupCard('done-user', false);
    expect(expectSetupCard('done-user')).toBe(false);
    rememberSetupCard('done-user', true);
    expect(expectSetupCard('done-user')).toBe(true);
  });

  it('expects the card when storage is unavailable', () => {
    const saved = globalThis.localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(expectSetupCard('anyone')).toBe(true);
    expect(() => rememberSetupCard('anyone', false)).not.toThrow();
    (globalThis as { localStorage?: unknown }).localStorage = saved;
  });
});

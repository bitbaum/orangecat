/**
 * @vitest-environment node
 *
 * Warming the reader's id must do NOTHING on the server.
 *
 * `warmCurrentUserId` is called at the top of every timeline read, and timeline
 * reads happen during server rendering too. Unguarded, it started an
 * unconditional `/auth/v1/user` request from the server using the BROWSER
 * Supabase client — which carries no request cookies, so it can only fail, and
 * it fails while the route is rendering.
 *
 * That wedged the server render of every feed page. /timeline, /community and
 * /dashboard sat on their route-level loading.tsx skeleton forever on a fresh
 * page load, while navigating to the same route from inside the app worked,
 * because that path never server-renders. Nothing appeared in the console and
 * every check was green; the skeleton is near-white on white, so it read as a
 * blank page.
 *
 * This test runs in the `node` environment on purpose. Under jsdom `window`
 * exists, the guard is never exercised, and this file would pass while the
 * server path stayed broken — which is exactly how the bug shipped.
 */

const getUser = vi.fn();

vi.mock('@/lib/supabase/browser', () => ({
  __esModule: true,
  default: {
    auth: {
      getUser: (...a: unknown[]) => getUser(...a),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

import { warmCurrentUserId } from '@/services/supabase/auth/session';

describe('warmCurrentUserId on the server', () => {
  it('has no window to speak of', () => {
    // Guard the premise: if this environment ever gains a window, the test
    // below stops testing anything and must not silently pass.
    expect(typeof window).toBe('undefined');
  });

  it('does not touch the network', async () => {
    warmCurrentUserId();
    // Let any promise it might have started settle.
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(getUser).not.toHaveBeenCalled();
  });
});

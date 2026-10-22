// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { AuthProvider } from '@/components/providers/AuthProvider';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

const mock = vi.hoisted(() => ({
  handler: null as null | ((event: AuthChangeEvent, session: Session | null) => void),
  hydrated: false,
  setInitial: vi.fn(),
  fetchProfile: vi.fn(),
  clear: vi.fn(),
  clearQueue: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock('@/lib/supabase/browser', () => ({
  default: {
    auth: {
      onAuthStateChange: (handler: typeof mock.handler) => {
        mock.handler = handler;
        return { data: { subscription: { unsubscribe: mock.unsubscribe } } };
      },
      signOut: vi.fn(),
    },
  },
}));
vi.mock('@/stores/auth', () => {
  const state = {
    setInitialAuthState: mock.setInitial,
    fetchProfile: mock.fetchProfile,
    clear: mock.clear,
  };
  return {
    useAuthStore: Object.assign((select: (s: typeof state) => unknown) => select(state), {
      getState: () => ({ hydrated: mock.hydrated, user: null }),
    }),
  };
});
vi.mock('@/lib/offline-queue', () => ({ offlineQueueService: { clearQueue: mock.clearQueue } }));

beforeEach(() => {
  vi.useFakeTimers();
  mock.hydrated = false;
  mock.setInitial.mockImplementation(() => {
    mock.hydrated = true;
  });
  mock.fetchProfile.mockResolvedValue(undefined);
  mock.clearQueue.mockResolvedValue(undefined);
  vi.mocked(fetch).mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

it('accepts the cookie session without a redundant server sync that can delay hydration', () => {
  render(<AuthProvider>Child</AuthProvider>);
  const session = { user: { id: 'signed-in-user' } } as Session;
  act(() => mock.handler!('INITIAL_SESSION', session));
  expect(mock.setInitial).toHaveBeenLastCalledWith(session.user, session, null);
  expect(fetch).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(5000));
  expect(mock.setInitial).toHaveBeenCalledTimes(1);
});

it('clears signed-out state immediately even if offline cleanup remains pending', () => {
  mock.clearQueue.mockReturnValue(new Promise(() => {}));
  render(<AuthProvider>Child</AuthProvider>);
  act(() => mock.handler!('SIGNED_OUT', null));
  expect(mock.clear).toHaveBeenCalledTimes(1);
  expect(mock.clearQueue).toHaveBeenCalledTimes(1);
});

// @vitest-environment jsdom
/**
 * Typing and presence write directly to their tables under RLS.
 *
 * Both used to call database functions that have never existed
 * (`set_typing_indicator`, `update_presence`). Production answered PGRST202,
 * each hook swallowed it into a debug log, and neither feature has ever worked.
 *
 * The replacement is a plain upsert rather than two new SECURITY DEFINER
 * functions, because the tables already carry the exact permissions those
 * functions would have re-implemented by hand: `user_presence` is keyed by
 * user_id, `typing_indicators` is UNIQUE (conversation_id, user_id), and RLS
 * scopes both to the owner. Verified against production under the
 * `authenticated` role: an outsider's typing insert is refused with "new row
 * violates row-level security policy", and two upserts leave exactly one row.
 *
 * What is pinned here is what a unit test can actually hold: the write shape
 * that RLS and the unique constraints require, and the TTL invariant that
 * decides whether the indicator flickers.
 */

import { renderHook, act, waitFor } from '@testing-library/react';

const upsert = vi.fn().mockResolvedValue({ error: null });
const del = vi.fn();
const eq2 = vi.fn().mockResolvedValue({ error: null });
const eq1 = vi.fn(() => ({ eq: eq2 }));
const from = vi.fn(() => ({ upsert, delete: del }));

del.mockImplementation(() => ({ eq: eq1 }));

vi.mock('@/lib/supabase/browser', () => ({
  __esModule: true,
  default: {
    from: (...a: unknown[]) => from(...(a as [])),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

// The subscription half is a separate concern; keep this test on the writes.
vi.mock('@/features/messaging/hooks/useTypingSubscription', () => ({
  useTypingSubscription: () => [],
}));
vi.mock('@/features/messaging/hooks/usePresenceActivity', () => ({
  usePresenceActivity: () => {},
}));

import { useTypingIndicator } from '@/features/messaging/hooks/useTypingIndicator';
import { usePresence } from '@/features/messaging/hooks/usePresence';

beforeEach(() => {
  from.mockClear();
  upsert.mockClear();
  del.mockClear();
  eq1.mockClear();
  eq2.mockClear();
});

describe('typing indicator writes', () => {
  it('upserts on the unique key, so repeat keystrokes cannot duplicate a row', async () => {
    const { result } = renderHook(() => useTypingIndicator('conv-1'));
    act(() => result.current.startTyping());

    await waitFor(() => expect(upsert).toHaveBeenCalled());
    expect(from).toHaveBeenCalledWith('typing_indicators');

    const [row, opts] = upsert.mock.calls[0];
    expect(row).toMatchObject({ conversation_id: 'conv-1', user_id: 'user-1' });
    // Without this exact conflict target the upsert becomes an insert and the
    // unique constraint rejects the second keystroke.
    expect(opts).toEqual({ onConflict: 'conversation_id,user_id' });
  });

  it('sets an expiry in the future, because readers filter on expires_at > now()', async () => {
    const { result } = renderHook(() => useTypingIndicator('conv-1'));
    act(() => result.current.startTyping());

    await waitFor(() => expect(upsert).toHaveBeenCalled());
    const row = upsert.mock.calls[0][0] as { expires_at: string; started_at: string };
    const ttlMs = new Date(row.expires_at).getTime() - new Date(row.started_at).getTime();

    // The hook refreshes every 5s; a TTL at or below that blinks the bubble out
    // between heartbeats. This is the invariant, not the literal number.
    expect(ttlMs).toBeGreaterThan(5000);
  });

  it('deletes its own row when typing stops, rather than writing a false flag', async () => {
    const { result } = renderHook(() => useTypingIndicator('conv-1'));
    act(() => result.current.startTyping());
    await waitFor(() => expect(upsert).toHaveBeenCalled());

    act(() => result.current.stopTyping());
    await waitFor(() => expect(del).toHaveBeenCalled());
    expect(eq1).toHaveBeenCalledWith('conversation_id', 'conv-1');
    expect(eq2).toHaveBeenCalledWith('user_id', 'user-1');
  });
});

describe('presence writes', () => {
  it('upserts the caller’s own row keyed by user_id', async () => {
    const { result } = renderHook(() => usePresence());
    act(() => result.current.setMyStatus('online'));

    await waitFor(() => expect(upsert).toHaveBeenCalled());
    expect(from).toHaveBeenCalledWith('user_presence');

    const [row, opts] = upsert.mock.calls[0];
    expect(row).toMatchObject({ user_id: 'user-1', status: 'online' });
    expect(opts).toEqual({ onConflict: 'user_id' });
  });

  it('does not claim a status it failed to write', async () => {
    upsert.mockResolvedValueOnce({ error: { message: 'denied' } });
    const { result } = renderHook(() => usePresence());
    act(() => result.current.setMyStatus('online'));

    await waitFor(() => expect(upsert).toHaveBeenCalled());
    // The old code set local state before knowing the write landed, so the UI
    // showed "online" for a user the database had never heard of.
    expect(result.current.myStatus).toBe('offline');
  });
});

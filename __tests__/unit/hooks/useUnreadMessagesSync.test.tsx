// @vitest-environment jsdom
/**
 * The header, the sidebar and the phone tab bar all read the unread-message
 * count from the messaging store (`useUnreadCount`). Nothing ever wrote it:
 * `setUnreadCount` had no caller anywhere in the app, so every Messages badge
 * sat at zero whatever was waiting, and `/api/messages/unread-count` had no
 * client. This pins the one writer: it fetches that count into the store, again
 * when this tab marks a conversation read or the window regains focus, and
 * zeroes it when nobody is signed in.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMessagingStore } from '@/stores/messaging';
import { API_ROUTES } from '@/config/api-routes';

let mockUser: { id: string } | null = { id: 'user-1' };
const removeChannel = vi.fn();

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser }) }));
vi.mock('@/lib/supabase/browser', () => {
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    __esModule: true,
    supabase: { channel: () => channel, removeChannel: (...a: unknown[]) => removeChannel(...a) },
  };
});

import { useUnreadMessagesSync, announceMessagesRead } from '@/hooks/useUnreadMessagesSync';

let serverCount = 0;
const fetchMock = vi.fn(async () => ({
  ok: true,
  json: async () => ({ success: true, data: { count: serverCount } }),
}));

beforeEach(() => {
  mockUser = { id: 'user-1' };
  serverCount = 0;
  fetchMock.mockClear();
  removeChannel.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  useMessagingStore.getState().clearAll();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const unread = () => useMessagingStore.getState().unreadCount;

it('fills the store every badge reads from the unread-count endpoint', async () => {
  serverCount = 4;
  renderHook(() => useUnreadMessagesSync());
  await waitFor(() => expect(unread()).toBe(4));
  expect(fetchMock).toHaveBeenCalledWith(API_ROUTES.MESSAGES.UNREAD_COUNT, expect.anything());
});

it('refetches when this tab marks a conversation read', async () => {
  serverCount = 2;
  renderHook(() => useUnreadMessagesSync());
  await waitFor(() => expect(unread()).toBe(2));

  serverCount = 0;
  act(() => announceMessagesRead());
  await waitFor(() => expect(unread()).toBe(0));
});

it('refetches when the window regains focus', async () => {
  serverCount = 1;
  renderHook(() => useUnreadMessagesSync());
  await waitFor(() => expect(unread()).toBe(1));

  serverCount = 5;
  act(() => {
    window.dispatchEvent(new Event('focus'));
  });
  await waitFor(() => expect(unread()).toBe(5));
});

it('keeps the last count when the endpoint fails', async () => {
  serverCount = 3;
  renderHook(() => useUnreadMessagesSync());
  await waitFor(() => expect(unread()).toBe(3));

  fetchMock.mockImplementationOnce(async () => ({ ok: false, json: async () => ({}) }));
  act(() => announceMessagesRead());
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(unread()).toBe(3);
});

it('shows nothing and asks nothing when signed out', () => {
  useMessagingStore.getState().setUnreadCount(7);
  mockUser = null;
  renderHook(() => useUnreadMessagesSync());
  expect(unread()).toBe(0);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('stops listening on unmount', async () => {
  const { unmount } = renderHook(() => useUnreadMessagesSync());
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  unmount();
  expect(removeChannel).toHaveBeenCalledTimes(1);
  act(() => announceMessagesRead());
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

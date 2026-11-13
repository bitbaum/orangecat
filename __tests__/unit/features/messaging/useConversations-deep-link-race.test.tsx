// @vitest-environment jsdom
/**
 * Opening /messages?id=… fetches the inbox list and the linked conversation's
 * summary side by side. They land in either order; neither may wipe out the
 * other. On production the summary landing second used to leave the inbox
 * holding only the linked conversation.
 */
import { act, renderHook } from '@testing-library/react';
import { useConversations } from '@/features/messaging/hooks/useConversations';
import { useMessagingStore } from '@/stores/messaging';
import type { Conversation } from '@/features/messaging/types';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'me' },
    hydrated: true,
    isLoading: false,
    isAuthenticated: true,
  }),
}));
vi.mock('@/features/messaging/hooks/useRealtimeSubscription', () => ({
  useRealtimeSubscription: () => undefined,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const conversation = (id: string): Conversation => ({
  id,
  title: id,
  is_group: false,
  last_message_at: null,
  last_message_preview: null,
  participants: [],
  unread_count: 0,
});

const mara = conversation('mara');
const crew = conversation('crew');
const jon = conversation('jon');
const old = conversation('old'); // older than the newest 30 the list returns

type Pending = { url: string; resolve: (body: unknown) => void };

function stubFetch() {
  const pending: Pending[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (url: string) =>
        new Promise(resolve => {
          pending.push({
            url,
            resolve: body => resolve({ ok: true, status: 200, json: async () => body }),
          });
        })
    )
  );
  const land = async (match: RegExp, body: unknown) => {
    const request = pending.find(p => match.test(p.url));
    expect(request, `a request matching ${match}`).toBeTruthy();
    await act(async () => {
      request!.resolve(body);
    });
  };
  return {
    landList: (list: Conversation[]) =>
      land(/\/api\/messages\?limit=30$/, { success: true, data: { conversations: list } }),
    landSummary: (c: Conversation) =>
      land(new RegExp(`/api/messages/${c.id}/summary$`), {
        success: true,
        data: { conversation: c },
      }),
  };
}

const inbox = () => useMessagingStore.getState().conversations.map(c => c.id);

beforeEach(() => {
  useMessagingStore.getState().clearAll();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('opening a conversation by link keeps the whole inbox', () => {
  it('keeps every listed conversation when the summary lands after the list', async () => {
    const net = stubFetch();
    renderHook(() => useConversations('', 'jon'));

    await net.landList([mara, crew, jon]);
    await net.landSummary(jon);

    expect(inbox()).toEqual(['mara', 'crew', 'jon']);
  });

  it('keeps the linked conversation when the list lands after its summary', async () => {
    const net = stubFetch();
    renderHook(() => useConversations('', 'old'));

    await net.landSummary(old);
    await net.landList([mara, crew, jon]);

    expect(inbox()).toEqual(['old', 'mara', 'crew', 'jon']);
  });

  it('adds a linked conversation the list does not hold when its summary lands second', async () => {
    const net = stubFetch();
    renderHook(() => useConversations('', 'old'));

    await net.landList([mara, crew, jon]);
    await net.landSummary(old);

    expect(inbox()).toEqual(['old', 'mara', 'crew', 'jon']);
  });

  it('takes the listed copy, once, when the list lands after the summary of a listed one', async () => {
    const net = stubFetch();
    renderHook(() => useConversations('', 'jon'));
    const listedJon = { ...jon, unread_count: 2 };

    await net.landSummary(jon);
    await net.landList([mara, crew, listedJon]);

    expect(useMessagingStore.getState().conversations).toEqual([mara, crew, listedJon]);
  });
});

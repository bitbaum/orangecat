// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import ConversationList from '@/components/messaging/ConversationList';
import { useMessagingStore } from '@/stores/messaging';
import type { Conversation, Participant } from '@/features/messaging/types';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'me' },
    hydrated: true,
    isLoading: false,
    isAuthenticated: true,
  }),
}));
vi.mock('@/features/messaging/hooks/useConversationsFetcher', () => ({
  useConversationsFetcher: () => ({
    loading: false,
    error: null,
    refreshing: false,
    lastFetch: 0,
    refresh: async () => {},
  }),
}));
vi.mock('@/features/messaging/hooks/useRealtimeSubscription', () => ({
  useRealtimeSubscription: () => {},
}));
vi.mock('@/components/ui/AvatarLink', () => ({ default: () => <span /> }));

const person = (id: string, name: string, username: string): Participant => ({
  user_id: id,
  username,
  name,
  avatar_url: null,
  role: 'member',
  joined_at: '',
  last_read_at: '',
  is_active: true,
});
const me = person('me', 'Me', 'me');
const mara = person('mara', 'Mara Keller', 'mara');

const conversations: Conversation[] = [
  {
    id: 'mara',
    title: null,
    is_group: false,
    last_message_at: '2026-11-11T10:00:00Z',
    last_message_preview: 'The walnut table is ready for pickup',
    participants: [me, mara],
    unread_count: 1,
  },
  {
    id: 'jon',
    title: null,
    is_group: false,
    last_message_at: '2026-11-10T10:00:00Z',
    last_message_preview: 'I sent the invoice yesterday',
    participants: [me, person('jon', 'Jon Brunner', 'jonb')],
    unread_count: 0,
  },
  {
    id: 'crew',
    title: 'Workshop crew',
    is_group: true,
    last_message_at: '2026-11-09T10:00:00Z',
    last_message_preview: 'Bring your own gloves',
    participants: [me, mara, person('pia', 'Pia Roth', 'pia')],
    unread_count: 0,
  },
];

function shown(searchQuery: string, filterTab: 'all' | 'unread' = 'all') {
  render(
    <ConversationList
      searchQuery={searchQuery}
      selectedConversationId={null}
      onSelectConversation={() => {}}
      filterTab={filterTab}
    />
  );
  return screen
    .queryAllByRole('button', { name: /^Open conversation with / })
    .map(row => row.getAttribute('aria-label')?.replace('Open conversation with ', ''));
}

beforeEach(() => {
  act(() => useMessagingStore.setState({ conversations }));
});
afterEach(cleanup);

it('finds a conversation by the words of its last message', () => {
  expect(shown('walnut')).toEqual(['Mara Keller']);
  cleanup();
  expect(shown('invoice')).toEqual(['Jon Brunner']);
  cleanup();
  expect(shown('gloves')).toEqual(['Workshop crew']);
});

it('finds a name typed with a slip', () => {
  expect(shown('mra')).toEqual(expect.arrayContaining(['Mara Keller', 'Workshop crew']));
});

it('gives the same hits on the All and Unread tabs, Unread keeping only the unread', () => {
  expect(shown('walnut', 'unread')).toEqual(['Mara Keller']);
  cleanup();
  expect(shown('gloves', 'unread')).toEqual([]);
  expect(within(document.body).getByText('No conversations match your search')).toBeInTheDocument();
});

it('lists every conversation when nothing is typed', () => {
  expect(shown('')).toEqual(['Mara Keller', 'Jon Brunner', 'Workshop crew']);
});

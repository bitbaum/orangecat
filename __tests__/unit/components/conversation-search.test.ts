import { evaluate, typoCases } from '@bitbaum/searchkit';
import { createConversationSearch } from '@/features/messaging/lib/conversation-search';
import type { Conversation, Participant } from '@/features/messaging/types';

const participant = (id: string, name: string): Participant => ({
  user_id: id,
  username: name.toLowerCase(),
  name,
  avatar_url: null,
  role: 'member',
  joined_at: '',
  last_read_at: '',
  is_active: true,
});
const conversations: Conversation[] = ['Miriam', 'Johannes', 'Catherine'].map((name, index) => ({
  id: String(index),
  title: null,
  is_group: false,
  last_message_at: null,
  last_message_preview: index === 0 ? 'Discuss the workshop' : null,
  participants: [participant('me', 'Current owner'), participant(name, name)],
  unread_count: 0,
}));

it('finds a participant despite a typing slip, and searches the visible preview', () => {
  const index = createConversationSearch(conversations, 'me');
  expect(index.search('Mriiam')[0].item.id).toBe('0');
  expect(index.search('workshop')[0].item.id).toBe('0');
  expect(index.search('Current owner')).toEqual([]);
});

it('retains the package-generated typo evaluation for conversation names', async () => {
  const index = createConversationSearch(conversations, 'me');
  const cases = typoCases(
    conversations.map(row => ({ id: row.id, name: row.participants[1].name })),
    { perWord: 10 }
  );
  const report = await evaluate(cases, query => index.search(query).map(hit => hit.item.id));
  expect(report.cases).toBeGreaterThan(0);
  expect(report.successAt1).toBe(1);
});

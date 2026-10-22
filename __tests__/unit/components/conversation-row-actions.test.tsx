// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConversationListItem } from '@/components/messaging/ConversationListItem';
import type { Conversation } from '@/features/messaging/types';

vi.mock('@/components/ui/AvatarLink', () => ({
  default: () => (
    <a href="/profiles/person" onClick={event => event.preventDefault()}>
      View profile
    </a>
  ),
}));
afterEach(cleanup);

it('keeps keyboard opening, profile navigation and deletion separate', async () => {
  const open = vi.fn(),
    remove = vi.fn();
  const conversation: Conversation = {
    id: 'conversation',
    title: 'Design discussion',
    is_group: false,
    last_message_at: null,
    last_message_preview: 'An update',
    unread_count: 1,
    participants: [
      {
        user_id: 'other',
        username: 'person',
        name: 'Person',
        avatar_url: null,
        role: 'member',
        joined_at: '',
        last_read_at: '',
        is_active: true,
      },
    ],
  };
  render(
    <ConversationListItem
      conversation={conversation}
      isSelected={false}
      isActiveConversation={false}
      selectionMode={false}
      currentUserId="me"
      onPointerDown={() => {}}
      onPointerEnter={() => {}}
      onPointerUp={() => {}}
      onClick={open}
      onToggleSelect={() => {}}
      onDeleteRequest={remove}
    />
  );
  const user = userEvent.setup();
  screen.getByRole('button', { name: 'Open conversation with Design discussion' }).focus();
  await user.keyboard('{Enter}');
  expect(open).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('link', { name: 'View profile' }));
  expect(open).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Delete conversation' }));
  expect(remove).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledTimes(1);
});

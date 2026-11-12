// @vitest-environment jsdom
/**
 * Two promises the Messages screen made and did not keep (live, 2026-11-12):
 *
 * - The New message picker said "People you follow or have talked to show up
 *   here", but with nothing typed it asked for the 20 newest sign-ups, which the
 *   placeholder and email-handle filters emptied. Nobody ever showed up.
 * - Edit and Delete on your own message opened only on right-click or
 *   long-press. From the keyboard there was no way to reach them.
 */
import { useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewConversationModal from '@/components/messaging/NewConversationModal';
import MessageItem from '@/components/messaging/MessageView/MessageItem';
import { MessageContextMenu } from '@/components/messaging/MessageContextMenu';
import { API_ROUTES } from '@/config/api-routes';
import type { Message } from '@/features/messaging/types';

const ME = '00000000-0000-4000-8000-000000000001';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: ME } }),
}));

const followed = {
  id: '00000000-0000-4000-8000-000000000002',
  username: 'mara',
  name: 'Mara Keller',
  avatar_url: 'https://example.com/mara.png',
};
const newestSignUp = {
  id: '00000000-0000-4000-8000-000000000003',
  username: 'brandnew',
  name: 'Brand New',
  avatar_url: 'https://example.com/new.png',
};

function json(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function answer(url: string, following: unknown[]) {
  if (url.startsWith(API_ROUTES.SOCIAL.FOLLOWING(ME))) {
    // The route's real envelope: rows nested two levels deep.
    return json({
      success: true,
      data: {
        data: following.map(profile => ({ following_id: (profile as { id: string }).id, profile })),
        pagination: { limit: 20, offset: 0, total: following.length },
      },
    });
  }
  if (url.startsWith(API_ROUTES.PROFILES.BASE)) {
    return json({ success: true, data: [newestSignUp] });
  }
  return json({ success: true, data: [] });
}

function requested(): string[] {
  return vi.mocked(fetch).mock.calls.map(([input]) => String(input));
}

afterEach(() => {
  cleanup();
  vi.mocked(fetch).mockReset();
});

describe('New message picker, nothing typed', () => {
  it('lists the people you follow, never the newest sign-ups', async () => {
    vi.mocked(fetch).mockImplementation(async input => answer(String(input), [followed]));
    render(<NewConversationModal isOpen onClose={() => {}} onCreated={() => {}} />);

    expect(await screen.findByText('Mara Keller')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'People you follow' })).toBeInTheDocument();
    expect(screen.queryByText('Brand New')).not.toBeInTheDocument();
    expect(requested()).toContain(API_ROUTES.SOCIAL.FOLLOWING(ME));
    expect(requested().some(url => url.startsWith(API_ROUTES.PROFILES.BASE))).toBe(false);
  });

  it('says only what it lists when you follow nobody', async () => {
    vi.mocked(fetch).mockImplementation(async input => answer(String(input), []));
    render(<NewConversationModal isOpen onClose={() => {}} onCreated={() => {}} />);

    expect(await screen.findByText('Find someone to message')).toBeInTheDocument();
    expect(
      screen.getByText('Type a name or @username above. People you follow show up here.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/have talked to/)).not.toBeInTheDocument();
  });

  it('treats spaces as nothing typed, and a typed name as a search', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation(async input => answer(String(input), [followed]));
    render(<NewConversationModal isOpen onClose={() => {}} onCreated={() => {}} />);
    await screen.findByText('Mara Keller');
    const box = screen.getByRole('searchbox', { name: 'Find a person to message' });

    await user.type(box, '  ');
    await waitFor(() => expect(requested().filter(u => u.includes('/following/'))).toHaveLength(2));
    expect(requested().some(url => url.startsWith(API_ROUTES.PROFILES.BASE))).toBe(false);

    await user.type(box, 'brand');
    expect(await screen.findByText('Brand New')).toBeInTheDocument();
    expect(requested()).toContain(`${API_ROUTES.PROFILES.BASE}?limit=20&search=brand`);
    expect(screen.queryByRole('heading', { name: 'People you follow' })).not.toBeInTheDocument();
  });
});

function message(id: string, sender: string, content: string): Message {
  return {
    id,
    conversation_id: 'c1',
    sender_id: sender,
    content,
    message_type: 'text',
    metadata: null,
    created_at: '2026-11-12T10:00:00.000Z',
    updated_at: '2026-11-12T10:00:00.000Z',
    is_deleted: false,
    edited_at: null,
  } as Message;
}

/** The thread as MessageView wires it: one menu, opened by any message. */
function Thread({ onEdit }: { onEdit: (id: string) => void }) {
  const [menu, setMenu] = useState<{ message: Message; x: number; y: number } | null>(null);
  const theirs = message('m1', 'someone-else', 'Is the table still there?');
  const mine = message('m2', ME, 'Yes, until Friday.');
  return (
    <>
      <button type="button">Before the thread</button>
      {[theirs, mine].map(m => (
        <MessageItem
          key={m.id}
          message={m}
          isCurrentUser={m.sender_id === ME}
          showDateDivider={false}
          onLongPress={(msg, pos) => setMenu({ message: msg, x: pos?.x ?? 0, y: pos?.y ?? 0 })}
        />
      ))}
      <MessageContextMenu
        isOpen={!!menu}
        position={{ x: menu?.x ?? 0, y: menu?.y ?? 0 }}
        onClose={() => setMenu(null)}
        onEdit={() => menu && onEdit(menu.message.id)}
        onDelete={() => {}}
        canEdit={menu?.message.sender_id === ME}
        canDelete={menu?.message.sender_id === ME}
      />
    </>
  );
}

describe('Your own message, from the keyboard', () => {
  it('has a Message actions button on your messages only', () => {
    render(<Thread onEdit={() => {}} />);
    const buttons = screen.getAllByRole('button', { name: 'Message actions' });
    expect(buttons).toHaveLength(1);
    expect(buttons[0].closest('div')?.textContent).toContain('Yes, until Friday.');
    expect(buttons[0]).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('Tab reaches it, Enter opens Edit and Delete with focus on Edit, Escape gives focus back', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<Thread onEdit={onEdit} />);

    screen.getByRole('button', { name: 'Before the thread' }).focus();
    await user.tab();
    const actions = screen.getByRole('button', { name: 'Message actions' });
    expect(actions).toHaveFocus();

    await user.keyboard('{Enter}');
    const menu = await screen.findByRole('menu', { name: 'Message actions' });
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus());

    // The menu listens for Escape a moment after it opens (so the opening
    // press cannot close it).
    await new Promise(resolve => setTimeout(resolve, 150));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(actions).toHaveFocus();

    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus());
    await user.keyboard('{Enter}');
    expect(onEdit).toHaveBeenCalledWith('m2');
  });
});

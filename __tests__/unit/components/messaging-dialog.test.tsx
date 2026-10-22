// @vitest-environment jsdom
import { useRef, useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewConversationModal from '@/components/messaging/NewConversationModal';

function Harness() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={trigger} onClick={() => setOpen(true)}>
        New conversation
      </button>
      <NewConversationModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onCreated={() => {}}
        returnFocusRef={trigger}
      />
    </>
  );
}

beforeEach(() => {
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: [] }) } as Response);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('exposes a named dialog, focuses search, and restores the trigger after Escape', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const trigger = screen.getByRole('button', { name: 'New conversation' });
  await user.click(trigger);
  expect(screen.getByRole('dialog', { name: 'New message' })).toBeInTheDocument();
  expect(screen.getByRole('searchbox', { name: 'Find a person to message' })).toHaveFocus();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
});

it('opens a fresh search after the previous sheet is closed', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'New conversation' }));
  await user.type(screen.getByRole('searchbox', { name: 'Find a person to message' }), 'Someone');
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'New conversation' }));
  expect(screen.getByRole('searchbox', { name: 'Find a person to message' })).toHaveValue('');
});

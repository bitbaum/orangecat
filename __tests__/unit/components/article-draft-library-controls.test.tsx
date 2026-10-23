// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import DraftsPanel from '@/app/(public)/articles/new/DraftsPanel';

afterEach(cleanup);
const draft = {
  id: 'a',
  title: 'My saved piece',
  body: 'Body',
  excerpt: '',
  coverImage: '',
  visibility: 'private' as const,
  updatedAt: Date.now(),
};
const props = () => ({
  restored: true,
  otherDrafts: [draft],
  onDiscard: vi.fn().mockReturnValue(true),
  onLoad: vi.fn(),
  onDelete: vi.fn().mockReturnValue(true),
  onNew: vi.fn(),
  hasOlderDrafts: true,
  onRecover: vi.fn(),
});
it('offers another draft without discarding the current writing', () => {
  const p = props();
  render(<DraftsPanel {...p} />);
  fireEvent.click(screen.getByRole('button', { name: 'New draft', exact: true }));
  expect(p.onNew).toHaveBeenCalledOnce();
  expect(p.onDiscard).not.toHaveBeenCalled();
});
it('requires confirmation and keeps a failed deletion visible for retry', () => {
  const p = props();
  p.onDelete.mockReturnValueOnce(false);
  render(<DraftsPanel {...p} />);
  fireEvent.click(screen.getByText('Manage drafts'));
  fireEvent.click(screen.getByRole('button', { name: 'Delete draft: My saved piece' }));
  expect(p.onDelete).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Delete My saved piece?');
  fireEvent.click(screen.getByRole('button', { name: 'Delete draft', exact: true }));
  expect(screen.getByRole('alert')).toHaveTextContent('Your writing is still here');
  expect(screen.getByRole('dialog')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Delete draft', exact: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('does not recover ownerless writing merely by displaying the library', () => {
  const p = props();
  render(<DraftsPanel {...p} />);
  expect(p.onRecover).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Manage drafts'));
  fireEvent.click(screen.getByText('Recover older device drafts'));
  expect(screen.getByText(/only if they belong to you/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'These are my drafts — recover' }));
  expect(p.onRecover).toHaveBeenCalledOnce();
});

it('returns focus to the opener when deletion is cancelled', async () => {
  render(<DraftsPanel {...props()} />);
  fireEvent.click(screen.getByText('Manage drafts'));
  const trigger = screen.getByRole('button', { name: 'Discard current draft' });
  trigger.focus();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: 'Keep draft' }));
  await waitFor(() => expect(trigger).toHaveFocus());
});

it('moves focus to New draft when successful deletion removes the opener', async () => {
  function Library() {
    const [restored, setRestored] = useState(true);
    return (
      <DraftsPanel
        {...props()}
        restored={restored}
        onDiscard={() => {
          setRestored(false);
          return true;
        }}
      />
    );
  }
  render(<Library />);
  fireEvent.click(screen.getByText('Manage drafts'));
  fireEvent.click(screen.getByRole('button', { name: 'Discard current draft' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete draft', exact: true }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'New draft', exact: true })).toHaveFocus()
  );
});

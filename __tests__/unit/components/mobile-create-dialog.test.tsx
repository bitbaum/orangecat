// @vitest-environment jsdom
import { useRef, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MobileCreateSheet } from '@/components/create/MobileCreateSheet';

vi.mock('@/components/create/VoiceCreate', () => ({ VoiceCreate: () => null }));
afterEach(cleanup);

function Harness() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={trigger} onClick={() => setOpen(true)}>
        Open Create
      </button>
      <MobileCreateSheet isOpen={open} onClose={() => setOpen(false)} returnFocusRef={trigger} />
    </>
  );
}

it('offers writing through a named dialog and restores focus after Escape', async () => {
  render(<Harness />);
  const trigger = screen.getByRole('button', { name: 'Open Create' });
  trigger.focus();
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog', { name: 'Create' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Article', exact: true })).toHaveAttribute(
    'href',
    '/articles/new'
  );
  expect(screen.getByRole('link', { name: 'Post', exact: true })).toHaveAttribute(
    'href',
    '/timeline?compose=true'
  );
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(trigger).toHaveFocus());
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

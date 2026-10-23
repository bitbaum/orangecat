// @vitest-environment jsdom
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

function Example() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Delete review item</button>
      <ConfirmDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {}}
        title="Delete review item?"
        description="A review fixture"
        confirmLabel="Delete"
      />
    </>
  );
}

describe('Confirmation focus return without a DialogTrigger', () => {
  it.each(['Cancel', 'Escape', 'Close'] as const)(
    'returns to the actual opener after %s',
    async action => {
      const user = userEvent.setup();
      render(<Example />);
      const opener = screen.getByRole('button', { name: 'Delete review item', exact: true });
      await user.click(opener);
      expect(screen.getByRole('dialog', { name: 'Delete review item?' })).toBeInTheDocument();
      if (action === 'Escape') await user.keyboard('{Escape}');
      else await user.click(screen.getByRole('button', { name: action, exact: true }));
      await waitFor(() => expect(opener).toHaveFocus());
    }
  );
});

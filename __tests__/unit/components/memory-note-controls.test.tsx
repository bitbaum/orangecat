// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryNoteCard } from '@/components/ai-chat/ModernChatPanel/components/MemoryNoteCard';

afterEach(cleanup);
const notes = [
  { id: 'one', content: 'Lives in Zurich' },
  { id: 'two', content: 'Works as a developer' },
];

it('keeps several facts behind a native disclosure and links to memory settings', () => {
  const { container } = render(
    <MemoryNoteCard notes={notes} onUndo={vi.fn()} onDismiss={vi.fn()} />
  );
  const details = container.querySelector('details')!;
  expect(details.open).toBe(false);
  fireEvent.click(screen.getByText('Cat noted 2 details'));
  expect(details.open).toBe(true);
  expect(screen.getByRole('link', { name: 'Review memories' })).toHaveAttribute(
    'href',
    '/settings/memory'
  );
});

it('reports failed Undo without dismissing the saved-memory notice', async () => {
  const dismiss = vi.fn();
  render(
    <MemoryNoteCard
      notes={[notes[0]]}
      onUndo={vi.fn().mockResolvedValue(false)}
      onDismiss={dismiss}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Undo memory: Lives in Zurich' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t confirm removal');
  expect(screen.getByText('“Lives in Zurich”')).toBeVisible();
  expect(dismiss).not.toHaveBeenCalled();
});

it('handles rejected Undo requests without an unhandled promise', async () => {
  render(
    <MemoryNoteCard
      notes={[notes[0]]}
      onUndo={vi.fn().mockRejectedValue(new Error('Network unavailable'))}
      onDismiss={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Undo memory: Lives in Zurich' }));
  expect(await screen.findByRole('alert')).toBeVisible();
});

it('tracks simultaneous Undo requests independently', async () => {
  let finishFirst!: (value: boolean) => void;
  let finishSecond!: (value: boolean) => void;
  const first = new Promise<boolean>(resolve => {
    finishFirst = resolve;
  });
  const second = new Promise<boolean>(resolve => {
    finishSecond = resolve;
  });
  render(
    <MemoryNoteCard
      notes={notes}
      onUndo={id => (id === 'one' ? first : second)}
      onDismiss={vi.fn()}
    />
  );
  fireEvent.click(screen.getByText('Cat noted 2 details'));
  const firstButton = screen.getByRole('button', { name: 'Undo memory: Lives in Zurich' });
  const secondButton = screen.getByRole('button', { name: 'Undo memory: Works as a developer' });
  fireEvent.click(firstButton);
  fireEvent.click(secondButton);
  expect(firstButton).toBeDisabled();
  expect(secondButton).toBeDisabled();
  finishFirst(true);
  await waitFor(() => expect(firstButton).toBeEnabled());
  expect(secondButton).toBeDisabled();
  finishSecond(true);
  await waitFor(() => expect(secondButton).toBeEnabled());
});

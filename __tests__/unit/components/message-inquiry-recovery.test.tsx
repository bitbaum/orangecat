// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessagesPage from '@/app/(authenticated)/messages/page';

const state = vi.hoisted(() => ({
  query: 'to=recipient',
  router: { replace: vi.fn() },
  open: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(state.query),
  useRouter: () => state.router,
}));
vi.mock('@/hooks/useAuth', () => ({
  useRequireAuth: () => ({ isLoading: false, isAuthenticated: true }),
}));
vi.mock('@/features/messaging/open-conversation.client', () => ({
  openConversationFor: state.open,
}));
vi.mock('@/components/messaging/MessagePanel', () => ({ default: () => <div>Inbox ready</div> }));
vi.mock('@/components/Loading', () => ({
  default: ({ message }: { message: string }) => <p>{message}</p>,
}));

beforeEach(() => {
  state.query = 'to=recipient';
  state.router.replace.mockReset();
  state.open.mockReset();
});
afterEach(cleanup);

it('reports an inquiry-open failure and retries without losing the destination', async () => {
  state.open
    .mockRejectedValueOnce(new Error('Connection lost'))
    .mockResolvedValueOnce('conversation-id');
  render(<MessagesPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost');
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() =>
    expect(state.router.replace).toHaveBeenCalledWith('/messages?id=conversation-id')
  );
  expect(state.open).toHaveBeenLastCalledWith(['recipient'], expect.any(AbortSignal));
});

it('leaves a pending inquiry when the user returns to the inbox', async () => {
  let resolve!: (id: string) => void;
  state.open.mockImplementation(
    () =>
      new Promise<string>(done => {
        resolve = done;
      })
  );
  const view = render(<MessagesPage />);
  expect(screen.getByText('Opening conversation…')).toBeInTheDocument();
  state.query = '';
  view.rerender(<MessagesPage />);
  expect(await screen.findByText('Inbox ready')).toBeInTheDocument();
  resolve('late-conversation');
  await waitFor(() => expect(state.router.replace).not.toHaveBeenCalled());
});

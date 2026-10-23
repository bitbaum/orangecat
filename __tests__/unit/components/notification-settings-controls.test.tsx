// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationSettingsPage from '@/app/(authenticated)/settings/notifications/page';
const { user } = vi.hoisted(() => ({ user: { id: 'own-profile' } }));
vi.mock('@/hooks/useAuth', () => ({ useRequireAuth: () => ({ user, isLoading: false }) }));
const preferences = {
  economic_emails: true,
  social_emails: true,
  group_emails: true,
  progress_emails: true,
  reengagement_emails: true,
  digest_frequency: 'weekly',
  type_overrides: {},
};
const response = () => new Response(JSON.stringify({ data: preferences }), { status: 200 });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('names every category and prevents overlapping autosave requests', async () => {
  let finish!: (value: Response) => void;
  const pending = new Promise<Response>(resolve => {
    finish = resolve;
  });
  const fetcher = vi.fn().mockResolvedValueOnce(response()).mockReturnValueOnce(pending);
  vi.stubGlobal('fetch', fetcher);
  render(<NotificationSettingsPage />);
  const economic = await screen.findByRole('checkbox', { name: 'Payments & orders' });
  const social = screen.getByRole('checkbox', { name: 'Social' });
  expect(screen.getByRole('checkbox', { name: 'Organizations' })).toBeChecked();
  fireEvent.click(economic);
  expect(social).toBeDisabled();
  fireEvent.click(social);
  expect(fetcher).toHaveBeenCalledTimes(2);
  finish(response());
  await waitFor(() => expect(social).toBeEnabled());
});
it('offers a real retry after the initial load fails', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response('{}', { status: 503 }))
    .mockResolvedValueOnce(response());
  vi.stubGlobal('fetch', fetcher);
  render(<NotificationSettingsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry loading preferences' }));
  expect(await screen.findByRole('checkbox', { name: 'Payments & orders' })).toBeChecked();
  expect(fetcher).toHaveBeenCalledTimes(2);
});

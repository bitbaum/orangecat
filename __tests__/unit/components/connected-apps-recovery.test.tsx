// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConnectedAppsCard from '@/components/settings/ConnectedAppsCard';
const app = (clientId: string) => ({
  clientId,
  name: clientId,
  scopes: ['profile'],
  withheldClaims: [],
  grantedAt: '2026-10-23T00:00:00Z',
  lastUsedAt: null,
  liveSessions: 1,
  registeredVia: 'manual',
});
afterEach(() => vi.unstubAllGlobals());
describe('Connected app recovery and pending operations', () => {
  it('retries a failed list load', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { apps: [] } }) })
    );
    render(<ConnectedAppsCard />);
    const retry = await screen.findByRole('button', { name: 'Retry loading connected apps' });
    await userEvent.click(retry);
    expect(await screen.findByText(/No app has signed in/)).toBeInTheDocument();
  });
  it('finishing one app save keeps the other app locked until its own request finishes', async () => {
    const user = userEvent.setup();
    let finishA!: (response: unknown) => void, finishB!: (response: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { apps: [app('Review A'), app('Review B')] } }),
        })
        .mockReturnValueOnce(
          new Promise(resolve => {
            finishA = resolve;
          })
        )
        .mockReturnValueOnce(
          new Promise(resolve => {
            finishB = resolve;
          })
        )
    );
    render(<ConnectedAppsCard />);
    const a = (await screen.findByText('Review A')).closest('li')!;
    const b = screen.getByText('Review B').closest('li')!;
    const claimA = within(a).getAllByRole('checkbox')[0],
      claimB = within(b).getAllByRole('checkbox')[0];
    await user.click(claimA);
    await user.click(claimB);
    expect(claimA).toBeDisabled();
    expect(claimB).toBeDisabled();
    expect(within(b).getByRole('button', { name: 'Disconnect' })).toBeDisabled();
    await act(async () => {
      finishA({ ok: true });
    });
    expect(claimA).toBeEnabled();
    expect(claimB).toBeDisabled();
    await act(async () => {
      finishB({ ok: false, status: 503 });
    });
    await waitFor(() => expect(claimB).toBeEnabled());
    expect(claimB).toBeChecked();
    expect(claimA).not.toBeChecked();
  });
});

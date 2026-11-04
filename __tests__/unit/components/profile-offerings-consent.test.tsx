// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OwnerProfileOfferings from '@/components/profile/OwnerProfileOfferings';
const privateState = {
  enabled: false,
  offerings: { skills: [{ name: 'Carpentry' }], assets: [], askedFor: [], notAvailableFor: [] },
};
afterEach(() => {
  vi.unstubAllGlobals();
});
describe('offerings sharing decision', () => {
  it('shows the private preview and only shares after the owner clicks', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: privateState }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { ...privateState, enabled: true } }),
      });
    vi.stubGlobal('fetch', fetcher);
    render(<OwnerProfileOfferings />);
    await screen.findByText('Your offerings are private');
    expect(screen.getByText('Carpentry')).toBeTruthy();
    expect(fetcher).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Make offerings public' }));
    await screen.findByText('Your offerings are public');
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ enabled: true }),
    });
    expect(screen.getByRole('button', { name: 'Hide offerings' })).toBeTruthy();
  });
  it('reloads an uncertain sharing decision without repeating the write', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: privateState }) })
      .mockRejectedValueOnce(new TypeError('response lost after write'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { ...privateState, enabled: true } }),
      });
    vi.stubGlobal('fetch', fetcher);
    render(<OwnerProfileOfferings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Make offerings public' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Could not confirm')
    );
    expect(screen.queryByText('Your offerings are private')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Your offerings are public');
    expect(fetcher.mock.calls.filter(call => call[1]?.method === 'PATCH')).toHaveLength(1);
    expect(fetcher.mock.calls[2][1]).toEqual({ cache: 'no-store' });
  });
});

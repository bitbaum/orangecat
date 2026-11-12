// @vitest-environment jsdom
/**
 * What a person sees on the identity screens when things are not simple
 * (ADR-0014, after review): a list that failed to load, an identity that
 * stands alone, a hand-over that worked but could not sign this browser in,
 * and a deletion that takes more than one account with it.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/components/auth/MFASetup', () => ({ MFASetup: () => null }));
vi.mock('@/components/ui/ConfirmDialog', () => ({
  ConfirmDialog: ({ isOpen, description }: { isOpen: boolean; description: string }) =>
    isOpen ? <p data-testid="confirm">{description}</p> : null,
}));

import { SettingsIdentitiesSection } from '@/app/(authenticated)/settings/SettingsIdentitiesSection';
import { SettingsModals } from '@/app/(authenticated)/settings/SettingsModals';
import { AcceptHandoverForm } from '@/app/identities/accept/[token]/AcceptHandoverForm';

type Member = {
  id: string;
  username: string | null;
  name: string | null;
  avatarUrl: null;
  isHolder: boolean;
  isCurrent: boolean;
};
const m = (id: string, extra: Partial<Member> = {}): Member => ({
  id,
  username: id,
  name: id,
  avatarUrl: null,
  isHolder: false,
  isCurrent: false,
  ...extra,
});

function circle(members: Member[], canManage = true) {
  return new Response(JSON.stringify({ success: true, data: { members, max: 5, canManage } }), {
    status: 200,
  });
}

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('Settings, Your identities', () => {
  it('says the list could not be loaded, offers nothing on it, and retries', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<SettingsIdentitiesSection />);
    expect(await screen.findByText('Could not load your identities.')).toBeInTheDocument();
    expect(screen.queryByText('Add an identity')).not.toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(circle([m('fernando', { isHolder: true, isCurrent: true })]));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Add an identity')).toBeInTheDocument();
  });

  it('tells an identity that stands alone why, and offers it nothing it cannot do', async () => {
    fetchMock.mockResolvedValueOnce(circle([m('alberto', { isCurrent: true })], false));
    render(<SettingsIdentitiesSection />);
    expect(await screen.findByText(/stands alone/)).toBeInTheDocument();
    expect(screen.queryByText('Add an identity')).not.toBeInTheDocument();
  });
});

describe('Delete account', () => {
  const modals = () => (
    <SettingsModals
      showMFASetup={false}
      setShowMFASetup={() => {}}
      deleteAccountConfirm
      setDeleteAccountConfirm={() => {}}
      onMFASetupComplete={() => {}}
      onDeleteConfirm={() => {}}
    />
  );

  it('names the identities a main account takes with it', async () => {
    fetchMock.mockResolvedValueOnce(
      circle([m('fernando', { isHolder: true, isCurrent: true }), m('caeiro'), m('reis')])
    );
    render(modals());
    await waitFor(() =>
      expect(screen.getByTestId('confirm')).toHaveTextContent(
        'also deletes your 2 identities (@caeiro, @reis)'
      )
    );
  });

  it('says an identity deletes only itself', async () => {
    fetchMock.mockResolvedValueOnce(
      circle([m('fernando', { isHolder: true }), m('caeiro', { isCurrent: true })])
    );
    render(modals());
    await waitFor(() =>
      expect(screen.getByTestId('confirm')).toHaveTextContent(
        'deletes @caeiro and everything it owns. Your main account and your other identities stay.'
      )
    );
  });
});

describe('Accepting a hand-over', () => {
  it('says it worked and how to get in, when this browser could not be signed in to it', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: { accepted: true, signedIn: false } }), {
        status: 200,
      })
    );
    render(<AcceptHandoverForm token="t" signedInElsewhere />);
    fireEvent.change(screen.getByLabelText(/Your email/), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accept and sign in' }));
    expect(await screen.findByText('It is yours')).toBeInTheDocument();
    expect(screen.getByText(/new@example.com/)).toBeInTheDocument();
    // It did not send them away into whatever account the browser had.
    expect(assign).not.toHaveBeenCalled();
  });
});

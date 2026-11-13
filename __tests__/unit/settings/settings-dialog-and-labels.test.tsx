// @vitest-environment jsdom
/**
 * Settings and the profile editor on orangecat.ch (2026-11-12, 320-390px):
 * - Two-factor setup opened a hand-rolled overlay: not a dialog, focus stayed
 *   behind it, Escape did nothing, and at 320px Cancel was off-screen.
 * - The manual npub field had no label.
 * - "How can others help?" options were cut off with an ellipsis on a phone.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import { SettingsModals } from '@/app/(authenticated)/settings/SettingsModals';
import { ProfileStatusSection } from '@/components/profile/sections/ProfileStatusSection';

vi.mock('@/lib/identities/client', () => ({ fetchIdentityCircle: async () => null }));
vi.mock('@/components/auth/MFASetup', () => ({
  MFASetup: ({ onCancel }: { onCancel: () => void }) => (
    <button type="button" onClick={onCancel}>
      Cancel
    </button>
  ),
}));

describe('two-factor setup', () => {
  const open = (setShowMFASetup = vi.fn()) => {
    render(
      <SettingsModals
        showMFASetup
        setShowMFASetup={setShowMFASetup}
        deleteAccountConfirm={false}
        setDeleteAccountConfirm={vi.fn()}
        onMFASetupComplete={vi.fn()}
        onDeleteConfirm={vi.fn()}
      />
    );
    return setShowMFASetup;
  };

  it('is a named dialog that holds focus', () => {
    open();
    const dialog = screen.getByRole('dialog', { name: 'Two-factor authentication' });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape', () => {
    const setShow = open();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(setShow).toHaveBeenCalledWith(false);
  });
});

function StatusSection() {
  const form = useForm();
  return (
    <FormProvider {...form}>
      <ProfileStatusSection control={form.control as never} />
    </FormProvider>
  );
}

describe('How can others help?', () => {
  it('wraps its options instead of cutting them off', () => {
    render(<StatusSection />);
    const options = screen.getAllByRole('button', { pressed: false });
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(option.className).not.toMatch(/\btruncate\b/);
      expect(option.className).toContain('whitespace-normal');
    }
  });
});

vi.mock('@/components/nostr/useNostrConnectionCard', () => ({
  useNostrConnectionCard: () => ({
    connected: false,
    npub: null,
    profile: null,
    nwcConnected: false,
    loading: false,
    error: null,
    hasExtension: false,
    showNpubInput: true,
    npubInput: '',
    setNpubInput: vi.fn(),
    setShowNpubInput: vi.fn(),
    showNwcInput: false,
    setShowNwcInput: vi.fn(),
    nwcInput: '',
    setNwcInput: vi.fn(),
    nwcError: null,
    copied: false,
    balanceSats: null,
    balanceLoading: false,
  }),
}));
vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({ formatSats: String }),
}));

import { NostrConnectionCard } from '@/components/nostr/NostrConnectionCard';

describe('Connected accounts', () => {
  it('names the manual npub field', () => {
    render(<NostrConnectionCard />);
    expect(
      screen.getByRole('textbox', { name: 'Your Nostr public key (npub)' })
    ).toBeInTheDocument();
  });
});

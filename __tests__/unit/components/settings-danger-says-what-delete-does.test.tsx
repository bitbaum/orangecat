// @vitest-environment jsdom
/**
 * Settings says what Delete Account does, and nothing it does not, in both
 * places a person reads it: the Danger Zone and the confirm dialog.
 *
 * Production (2026-11-12) promised "all associated data" in the Danger Zone and
 * "All your data will be permanently deleted" in the dialog, the last thing
 * shown before the click. Neither was true once other people's records stay.
 * Both now read ACCOUNT_DELETION_COPY, whose every sentence delete_account()
 * (migration 20261112203000) makes true.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { SettingsDangerSection } from '@/app/(authenticated)/settings/SettingsDangerSection';
import { SettingsModals } from '@/app/(authenticated)/settings/SettingsModals';
import { ACCOUNT_DELETION_COPY } from '@/config/account-deletion';

vi.mock('@/lib/identities/client', () => ({
  fetchIdentityCircle: vi.fn().mockRejectedValue(new Error('offline')),
}));
vi.mock('@/components/auth/MFASetup', () => ({ MFASetup: () => null }));

const copy = ACCOUNT_DELETION_COPY.whatHappens;

describe('what Delete Account says', () => {
  it('names what goes: the profile, every owned page, posts and the messages they sent', () => {
    expect(copy).toMatch(/removes your profile, every page you own/);
    expect(copy).toMatch(/projects, products, services, causes, loans, events, wishlists/);
    expect(copy).toMatch(/your posts with the replies under them, and the messages you sent/);
    expect(copy).toMatch(/cannot be undone/);
  });

  it('names what stays with other people, and with groups', () => {
    expect(copy).toMatch(
      /payments, orders, support, offers, tickets, contributions, deals and bookings, and the conversations you were in/
    );
    expect(copy).toMatch(/Pages you made for a group stay with the group/);
    expect(copy).toMatch(/passes to its longest-standing admin, or member if it has no admin/);
    expect(copy).toMatch(/nobody else in it has its pages unpublished/);
  });

  it('no longer promises to delete what is kept', () => {
    expect(copy).not.toMatch(/all associated data/i);
    expect(copy).not.toMatch(/All your data/i);
    expect(copy).not.toMatch(/transaction history/);
  });

  it('is what the Danger Zone shows', () => {
    render(<SettingsDangerSection isDeleting={false} onDelete={() => {}} />);
    expect(screen.getByText(copy)).toBeTruthy();
  });

  it('is what the confirm dialog shows before the click', async () => {
    render(
      <SettingsModals
        showMFASetup={false}
        setShowMFASetup={() => {}}
        deleteAccountConfirm
        setDeleteAccountConfirm={() => {}}
        onMFASetupComplete={() => {}}
        onDeleteConfirm={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByText(copy)).toBeTruthy());
    expect(screen.queryByText(/All your data will be permanently deleted/)).toBeNull();
  });
});

// @vitest-environment jsdom
/**
 * Settings → Danger Zone says what Delete Account does, and nothing it does not.
 *
 * Production (2026-11-12) promised to delete "all associated data including
 * your profile, projects, and transaction history". Payment records have no
 * foreign key to the account and stay, and orders are the other party's record
 * too, so that line could not be kept — and the delete itself failed for
 * anyone who owned a page. The account's pages now go first and the person's
 * side of an order or loan payment becomes NULL (migration 20261112203000), so
 * the copy says exactly that.
 */
import { render, screen } from '@testing-library/react';
import { SettingsDangerSection } from '@/app/(authenticated)/settings/SettingsDangerSection';

describe('SettingsDangerSection', () => {
  it('says the profile and every owned page go, and that records with other people stay', () => {
    render(<SettingsDangerSection isDeleting={false} onDelete={() => {}} />);
    const copy = screen.getByText(/permanently deletes your account/).textContent ?? '';

    expect(copy).toMatch(/your profile and every page you own/);
    expect(copy).toMatch(/projects, products, services, causes, loans/);
    expect(copy).toMatch(/Groups you are in stay with their other members/);
    expect(copy).toMatch(/orders and payments between you and other people stay in their records/);
    expect(copy).toMatch(/cannot be undone/);
  });

  it('no longer promises to delete what is kept', () => {
    render(<SettingsDangerSection isDeleting={false} onDelete={() => {}} />);
    const copy = screen.getByText(/permanently deletes your account/).textContent ?? '';

    expect(copy).not.toMatch(/all associated data/);
    expect(copy).not.toMatch(/transaction history/);
  });
});

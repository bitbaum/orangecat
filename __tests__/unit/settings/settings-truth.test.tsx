// @vitest-environment jsdom
/**
 * Settings copy that said what the product does not do (orangecat.ch,
 * 2026-11-12):
 * - Export described a file far smaller than "the data we store about you".
 * - Deleting Cat conversations sent people to "AI settings" for memories,
 *   which live on the Memory tab.
 * - The public contact email said it defaulted to the registration email;
 *   since #1589 it is never pre-filled.
 */
import { render, screen } from '@testing-library/react';
import { SettingsDataSection } from '@/app/(authenticated)/settings/SettingsDataSection';
import { profileGuidanceContent } from '@/lib/profile-guidance';
import { ROUTES } from '@/config/routes';
import { EXPORT_SCOPE } from '@/domain/account/exportAccount';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('settings copy says what the product does', () => {
  it('the export description names what the file holds', () => {
    render(<SettingsDataSection />);
    const text = document.body.textContent ?? '';
    for (const words of ['every page you own', 'posts', 'payment requests', 'notifications']) {
      expect(text).toContain(words);
    }
    expect(EXPORT_SCOPE.some(s => s.startsWith('pages'))).toBe(true);
  });

  it('memories point at the Memory tab, as a link', () => {
    render(<SettingsDataSection />);
    expect(document.body.textContent).not.toContain('AI settings');
    expect(screen.getByRole('link', { name: 'Memory tab' })).toHaveAttribute(
      'href',
      ROUTES.SETTINGS_MEMORY
    );
  });

  it('the contact email guidance no longer claims a default', () => {
    const tips = profileGuidanceContent.contactEmail.tips?.join(' ') ?? '';
    expect(tips).not.toMatch(/defaults to your registration email/i);
  });
});

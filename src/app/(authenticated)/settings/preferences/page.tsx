'use client';

/**
 * Settings → Preferences — how OrangeCat reads to you: currency, dates, theme.
 *
 * These lived at the bottom of the Account page, below sign-in, devices and
 * identities, thousands of pixels down. They are not account security, so
 * they have their own section; each saves the moment it changes.
 */

import { useRequireAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import { SettingsFrame } from '../SettingsFrame';
import { SettingsPreferencesSection } from '../SettingsPreferencesSection';
import { SettingsAppearanceSection } from '../SettingsAppearanceSection';

export default function PreferencesSettingsPage() {
  const { user, isLoading } = useRequireAuth();

  if (isLoading) {
    return <Loading fullScreen />;
  }
  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <SettingsFrame title="Amounts and dates">
        <SettingsPreferencesSection />
      </SettingsFrame>
      <SettingsFrame title="Appearance">
        <SettingsAppearanceSection />
      </SettingsFrame>
    </div>
  );
}

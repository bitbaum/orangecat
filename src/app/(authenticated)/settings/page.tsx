'use client';

import { useRequireAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import Link from 'next/link';
import { ROUTES } from '@/config/routes';
import { accountHasNoEmail } from '@/lib/auth/account-email';
import { SettingsFrame } from './SettingsFrame';
import { SettingsDevicesSection } from './SettingsDevicesSection';
import { useSettingsForm } from './useSettingsForm';
import { SettingsEmailSection } from './SettingsEmailSection';
import { SettingsPasswordSection } from './SettingsPasswordSection';
import { SettingsSecuritySection } from './SettingsSecuritySection';
import { SettingsDangerSection } from './SettingsDangerSection';
import { SettingsDataSection } from './SettingsDataSection';
import { SettingsIdentitiesSection } from './SettingsIdentitiesSection';
import { SettingsIdentityAccountNote } from './SettingsIdentityAccountNote';
import { isUnreachableEmail } from '@/config/identities';
import { SettingsModals } from './SettingsModals';

export default function SettingsPage() {
  const { user, isLoading } = useRequireAuth();
  const {
    formData,
    isSubmittingEmail,
    isSubmittingPassword,
    isDeleting,
    deleteAccountConfirm,
    setDeleteAccountConfirm,
    showPassword,
    setShowPassword,
    showMFASetup,
    setShowMFASetup,
    mfaStatusKey,
    refreshMFAStatus,
    handleInputChange,
    handleEmailUpdate,
    handlePasswordSubmit,
    handleDeleteAccount,
    executeDeleteAccount,
  } = useSettingsForm(user ?? null);

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (!user) {
    return null;
  }

  const noEmail = accountHasNoEmail(user);

  return (
    <>
      <div className="space-y-6">
        <SettingsFrame title="Sign-in" description="How you get into this account.">
          {isUnreachableEmail(user.email) ? (
            <SettingsIdentityAccountNote />
          ) : (
            <>
              <SettingsEmailSection
                email={formData.email}
                noEmail={noEmail}
                isSubmitting={isSubmittingEmail}
                onChange={handleInputChange}
                onSubmit={handleEmailUpdate}
              />
              {/* A password needs an email to sign in with; it waits until there is one. */}
              {!noEmail && (
                <SettingsPasswordSection
                  newPassword={formData.newPassword}
                  confirmPassword={formData.confirmPassword}
                  showPassword={showPassword}
                  setShowPassword={setShowPassword}
                  isSubmitting={isSubmittingPassword}
                  onChange={handleInputChange}
                  onSubmit={handlePasswordSubmit}
                />
              )}
            </>
          )}
          <SettingsSecuritySection
            mfaStatusKey={mfaStatusKey}
            onEnableMFA={() => setShowMFASetup(true)}
            onMFADisableComplete={refreshMFAStatus}
          />
        </SettingsFrame>

        <SettingsFrame title="Devices">
          <SettingsDevicesSection />
        </SettingsFrame>

        <SettingsFrame title="Identities">
          <SettingsIdentitiesSection />
        </SettingsFrame>

        <SettingsFrame title="Your data">
          <SettingsDataSection />
        </SettingsFrame>

        <SettingsFrame title="Delete account">
          <SettingsDangerSection isDeleting={isDeleting} onDelete={handleDeleteAccount} />
        </SettingsFrame>

        <p className="mb-0 text-sm text-fg-secondary">
          Currency, date format and theme are under{' '}
          <Link href={ROUTES.SETTINGS_PREFERENCES} className="underline underline-offset-2">
            Preferences
          </Link>
          .
        </p>
      </div>

      <SettingsModals
        showMFASetup={showMFASetup}
        setShowMFASetup={setShowMFASetup}
        deleteAccountConfirm={deleteAccountConfirm}
        setDeleteAccountConfirm={setDeleteAccountConfirm}
        onMFASetupComplete={() => {
          setShowMFASetup(false);
          refreshMFAStatus();
        }}
        onDeleteConfirm={executeDeleteAccount}
      />
    </>
  );
}

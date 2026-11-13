'use client';

import { useRef } from 'react';
import { useRequireAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import { Lock } from 'lucide-react';
import { useSettingsForm } from './useSettingsForm';
import { SettingsEmailSection } from './SettingsEmailSection';
import { SettingsPasswordSection } from './SettingsPasswordSection';
import { SettingsSecuritySection } from './SettingsSecuritySection';
import { SettingsDangerSection } from './SettingsDangerSection';
import { SettingsDataSection } from './SettingsDataSection';
import { SettingsIdentitiesSection } from './SettingsIdentitiesSection';
import { SettingsIdentityAccountNote } from './SettingsIdentityAccountNote';
import { isUnreachableEmail } from '@/config/identities';
import { SettingsPreferencesSection } from './SettingsPreferencesSection';
import { SettingsAppearanceSection } from './SettingsAppearanceSection';
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
  const emailInputRef = useRef<HTMLInputElement>(null);
  // The one step that gives a "Start instantly" account a way back in.
  const focusEmail = () => {
    emailInputRef.current?.scrollIntoView({ block: 'center' });
    emailInputRef.current?.focus({ preventScroll: true });
  };

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <div className="bg-surface-base rounded-lg border border-subtle overflow-hidden">
        <div className="flex items-center gap-4 border-b border-subtle px-4 py-5 sm:px-8 sm:py-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-fg-secondary">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-fg-primary">
              Account &amp; Security
            </h2>
            <p className="mt-0.5 text-sm text-fg-secondary">
              Manage your login credentials and account security
            </p>
          </div>
        </div>

        <div className="space-y-10 p-4 sm:p-8">
          {isUnreachableEmail(user.email) ? (
            <SettingsIdentityAccountNote />
          ) : (
            <>
              <SettingsEmailSection
                email={formData.email}
                hasEmail={Boolean(user.email)}
                inputRef={emailInputRef}
                isSubmitting={isSubmittingEmail}
                onChange={handleInputChange}
                onSubmit={handleEmailUpdate}
              />
              <SettingsPasswordSection
                newPassword={formData.newPassword}
                confirmPassword={formData.confirmPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                isSubmitting={isSubmittingPassword}
                onChange={handleInputChange}
                onSubmit={handlePasswordSubmit}
              />
            </>
          )}
          <SettingsSecuritySection
            // Adding an email changes the ways in: count them again.
            key={user.email || 'no-email'}
            mfaStatusKey={mfaStatusKey}
            onEnableMFA={() => setShowMFASetup(true)}
            onMFADisableComplete={refreshMFAStatus}
            accountIsAnonymous={user.is_anonymous === true}
            onAddEmail={isUnreachableEmail(user.email) ? undefined : focusEmail}
          />
          <SettingsIdentitiesSection />

          <SettingsPreferencesSection />

          <SettingsAppearanceSection />

          <SettingsDataSection />

          <SettingsDangerSection isDeleting={isDeleting} onDelete={handleDeleteAccount} />
        </div>
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

'use client';

import { ArrowLeft } from 'lucide-react';
import Loading from '@/components/Loading';
import EntityListShell from '@/components/entity/EntityListShell';
import ModernProfileEditor from '@/components/profile/ModernProfileEditor';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { useProfileEdit } from './useProfileEdit';
import { ProfileSidebarPanel } from './ProfileSidebarPanel';
import { ProfileMobileCompletion, ProfileMobileSupport } from './ProfileMobileSupport';
import { getProfileMissingFields } from './profile-completion';

export default function DashboardInfoEditPage() {
  const {
    user,
    profile,
    isLoading,
    focusedField,
    setFocusedField,
    completionPercentage,
    showMobileGuidance,
    setShowMobileGuidance,
    handleSave,
    handleCancel,
  } = useProfileEdit();

  if (isLoading) {
    return <Loading />;
  }
  if (!user) {
    return null;
  }
  if (!profile) {
    return <Loading />;
  }

  const missingFields = getProfileMissingFields(profile);

  return (
    <EntityListShell
      title="Edit profile"
      description="Update your profile details. This information will be visible on your public profile."
      headerActions={
        <Button href={ROUTES.DASHBOARD.INFO} variant="ghost" size="sm" className="min-h-11">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to profile
        </Button>
      }
    >
      <ProfileMobileSupport
        focusedField={focusedField}
        showMobileGuidance={showMobileGuidance}
        setShowMobileGuidance={setShowMobileGuidance}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="hidden lg:block lg:col-span-5 lg:order-2">
          <ProfileSidebarPanel
            profile={profile}
            completionPercentage={completionPercentage}
            focusedField={focusedField}
          />
        </div>

        <div className="space-y-4 lg:col-span-7 lg:order-1">
          <ModernProfileEditor
            profile={profile}
            userId={user.id}
            userEmail={user.email}
            onSave={handleSave}
            onCancel={handleCancel}
            onFieldFocus={setFocusedField}
            inline={true}
          />
          <ProfileMobileCompletion
            completionPercentage={completionPercentage}
            missingFields={missingFields}
          />
        </div>
      </div>
    </EntityListShell>
  );
}

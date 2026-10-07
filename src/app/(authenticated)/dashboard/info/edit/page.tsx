'use client';

import { Edit, ArrowLeft } from 'lucide-react';
import Loading from '@/components/Loading';
import { cn } from '@/lib/utils';
import { GRADIENTS } from '@/config/gradients';
import ModernProfileEditor from '@/components/profile/ModernProfileEditor';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { useProfileEdit } from './useProfileEdit';
import { ProfileSidebarPanel } from './ProfileSidebarPanel';
import { ProfileMobileSupport } from './ProfileMobileSupport';
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
    <div className={cn(GRADIENTS.pageBg, 'min-h-screen')}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <ProfileMobileSupport
          completionPercentage={completionPercentage}
          missingFields={missingFields}
          focusedField={focusedField}
          showMobileGuidance={showMobileGuidance}
          setShowMobileGuidance={setShowMobileGuidance}
        />

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Button
              href={ROUTES.DASHBOARD.INFO}
              variant="ghost"
              size="sm"
              className="mr-2 min-h-11"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to View
            </Button>
            <div className="p-2 bg-surface-raised rounded-lg">
              <Edit className="w-5 h-5 text-fg-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-fg-primary">Edit Profile</h1>
          </div>
          <p className="text-base text-fg-secondary ml-12">
            Update your profile details. This information will be visible on your public profile.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="hidden lg:block lg:col-span-5 lg:order-2">
            <ProfileSidebarPanel
              profile={profile}
              completionPercentage={completionPercentage}
              focusedField={focusedField}
            />
          </div>

          <div className="lg:col-span-7 lg:order-1">
            <ModernProfileEditor
              profile={profile}
              userId={user.id}
              userEmail={user.email}
              onSave={handleSave}
              onCancel={handleCancel}
              onFieldFocus={setFocusedField}
              inline={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

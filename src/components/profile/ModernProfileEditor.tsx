'use client';

import { Form } from '@/components/ui/form';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import ProfileWizard from './ProfileWizard';
import { useProfileEditor } from './hooks/useProfileEditor';
import { ProfileImagesSection } from './ProfileImagesSection';
import { ProfileBasicSection } from './sections/ProfileBasicSection';
import { ProfileStatusSection } from './sections/ProfileStatusSection';
import { OnlinePresenceSection } from './sections/OnlinePresenceSection';
import { ContactSection } from './sections/ContactSection';
import { PreferencesSection } from './sections/PreferencesSection';
import { FormErrorDisplay } from './components/FormErrorDisplay';
import { ProfileFormActions } from './components/ProfileFormActions';
import type { ModernProfileEditorProps } from './types';

export default function ModernProfileEditor({
  profile,
  userId,
  userEmail,
  onSave,
  onCancel,
  useWizard = false,
  onFieldFocus,
  inline = false,
}: ModernProfileEditorProps) {
  // Use the extracted hook for all profile editing logic
  const {
    form,
    isSaving,
    avatarPreview,
    bannerPreview,
    avatarInputRef,
    bannerInputRef,
    handleFileUpload,
    socialLinks,
    setSocialLinks,
    locationMode,
    setLocationMode,
    locationGroupLabel,
    setLocationGroupLabel,
    onSubmit,
  } = useProfileEditor({
    profile,
    userId,
    userEmail,
    onSave,
    onCancel,
    onFieldFocus,
  });

  // Watch for username changes (needed for form validation)
  const watchedUsername = form.watch('username');

  // Use wizard if requested
  if (useWizard) {
    return (
      <ProfileWizard
        profile={profile}
        userId={userId}
        userEmail={(typeof userEmail === 'string' ? userEmail : '') || ''}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

  // Render inline (for dedicated edit page) or as modal (for popup editing)
  if (inline) {
    // Inline mode: clean form layout without modal wrapper (page provides header/layout)
    return (
      <div className="bg-surface-base rounded-lg border border-default shadow-sm overflow-hidden">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6">
            {/* Form Errors */}
            <FormErrorDisplay errors={form.formState.errors} />

            {/* Profile Images Section */}
            <ProfileImagesSection
              profile={profile}
              avatarPreview={avatarPreview}
              bannerPreview={bannerPreview}
              avatarInputRef={avatarInputRef}
              bannerInputRef={bannerInputRef}
              handleFileUpload={handleFileUpload}
            />

            {/* Form Fields */}
            <div className="space-y-8">
              {/* Profile Basic Section */}
              <ProfileBasicSection
                control={form.control}
                onFieldFocus={onFieldFocus}
                locationMode={locationMode}
                setLocationMode={setLocationMode}
                locationGroupLabel={locationGroupLabel}
                setLocationGroupLabel={setLocationGroupLabel}
                form={form}
              />

              {/* Status & How to Help Section */}
              <ProfileStatusSection control={form.control} />

              {/* Online Presence Section */}
              <OnlinePresenceSection
                control={form.control}
                onFieldFocus={onFieldFocus}
                socialLinks={socialLinks}
                setSocialLinks={setSocialLinks}
              />

              {/* Contact Section */}
              <ContactSection
                control={form.control}
                onFieldFocus={onFieldFocus}
                userEmail={userEmail}
              />

              {/* Preferences Section */}
              <PreferencesSection control={form.control} onFieldFocus={onFieldFocus} />
            </div>

            {/* Action Buttons */}
            <ProfileFormActions
              isSaving={isSaving}
              isValid={!!watchedUsername?.trim()}
              onCancel={onCancel}
              variant="inline"
            />
          </form>
        </Form>
      </div>
    );
  }

  // Modal mode (default)
  return (
    <Dialog open onOpenChange={open => !open && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogTitle>Edit profile</DialogTitle>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Form Errors */}
            <FormErrorDisplay errors={form.formState.errors} />

            {/* Profile Images Section */}
            <ProfileImagesSection
              profile={profile}
              avatarPreview={avatarPreview}
              bannerPreview={bannerPreview}
              avatarInputRef={avatarInputRef}
              bannerInputRef={bannerInputRef}
              handleFileUpload={handleFileUpload}
            />

            {/* Form Fields */}
            <div className="space-y-8">
              {/* Profile Basic Section */}
              <ProfileBasicSection
                control={form.control}
                onFieldFocus={onFieldFocus}
                locationMode={locationMode}
                setLocationMode={setLocationMode}
                locationGroupLabel={locationGroupLabel}
                setLocationGroupLabel={setLocationGroupLabel}
                form={form}
              />

              {/* Status & How to Help Section */}
              <ProfileStatusSection control={form.control} />

              {/* Online Presence Section */}
              <OnlinePresenceSection
                control={form.control}
                onFieldFocus={onFieldFocus}
                socialLinks={socialLinks}
                setSocialLinks={setSocialLinks}
              />

              {/* Contact Section */}
              <ContactSection
                control={form.control}
                onFieldFocus={onFieldFocus}
                userEmail={userEmail}
              />

              {/* Preferences Section */}
              <PreferencesSection control={form.control} onFieldFocus={onFieldFocus} />
            </div>

            {/* Action Buttons */}
            <ProfileFormActions
              isSaving={isSaving}
              isValid={!!watchedUsername?.trim()}
              onCancel={onCancel}
              variant="modal"
            />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

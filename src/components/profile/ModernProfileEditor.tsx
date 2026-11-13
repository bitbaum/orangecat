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
import { PrivacySection } from './sections/PrivacySection';
import { FormErrorDisplay } from './components/FormErrorDisplay';
import { ProfileFormActions } from './components/ProfileFormActions';
import type { ModernProfileEditorProps } from './types';

interface ProfileEditorFormProps {
  editor: ReturnType<typeof useProfileEditor>;
  profile: ModernProfileEditorProps['profile'];
  userEmail: ModernProfileEditorProps['userEmail'];
  onFieldFocus: ModernProfileEditorProps['onFieldFocus'];
  onCancel: ModernProfileEditorProps['onCancel'];
  variant: 'inline' | 'modal';
}

/**
 * Shared form body for both inline and modal rendering modes.
 * The two modes only differ in their wrapper and form padding.
 */
function ProfileEditorForm({
  editor,
  profile,
  userEmail,
  onFieldFocus,
  onCancel,
  variant,
}: ProfileEditorFormProps) {
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
  } = editor;

  // Watch for username changes (needed for form validation)
  const watchedUsername = form.watch('username');

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={variant === 'inline' ? 'space-y-6 p-3 sm:p-6' : 'space-y-6'}
      >
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
          <PreferencesSection />

          {/* Privacy Section — per-field visibility to visitors */}
          <PrivacySection form={form} />
        </div>

        {/* Action Buttons */}
        <ProfileFormActions
          isSaving={isSaving}
          isValid={!!watchedUsername?.trim()}
          onCancel={onCancel}
          variant={variant}
        />
      </form>
    </Form>
  );
}

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
  const editor = useProfileEditor({
    profile,
    userId,
    userEmail,
    onSave,
    onCancel,
    onFieldFocus,
  });

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
      <div className="rounded-lg border border-default bg-surface-base shadow-sm">
        <ProfileEditorForm
          editor={editor}
          profile={profile}
          userEmail={userEmail}
          onFieldFocus={onFieldFocus}
          onCancel={onCancel}
          variant="inline"
        />
      </div>
    );
  }

  // Modal mode (default)
  return (
    <Dialog open onOpenChange={open => !open && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogTitle>Edit profile</DialogTitle>

        <ProfileEditorForm
          editor={editor}
          profile={profile}
          userEmail={userEmail}
          onFieldFocus={onFieldFocus}
          onCancel={onCancel}
          variant="modal"
        />
      </DialogContent>
    </Dialog>
  );
}

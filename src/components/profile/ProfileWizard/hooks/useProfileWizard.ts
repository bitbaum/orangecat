/**
 * PROFILE WIZARD STATE HOOK
 * Manages form state and navigation for the wizard
 */

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema } from '@/lib/validation';
import { logger } from '@/utils/logger';
import { WIZARD_STEPS } from '../constants';
import type { ProfileFormValues, ProfileWizardProps, WizardState, WizardActions } from '../types';
import type { ProfileFormData } from '@/types/database';

interface UseProfileWizardReturn extends WizardState, WizardActions {
  form: ReturnType<typeof useForm<ProfileFormValues>>;
  steps: typeof WIZARD_STEPS;
  currentStepData: (typeof WIZARD_STEPS)[number];
}

export function useProfileWizard(
  profile: ProfileWizardProps['profile'],
  userEmail: string,
  onSave: ProfileWizardProps['onSave']
): UseProfileWizardReturn {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Form setup
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues: {
      // No email fallback: username is NOT NULL and always set by a creation
      // path, so this only ever fired on a half-loaded profile — and when it
      // did it pre-filled the PUBLIC handle field with the user's email local
      // part, one Save away from publishing it.
      username: profile.username || '',
      name: profile.name || '',
      bio: profile.bio || '',
      location_country: profile.location_country || '',
      location_city: profile.location_city || '',
      location_zip: profile.location_zip || '',
      location_search: profile.location_search || '',
      latitude: profile.latitude ?? undefined,
      longitude: profile.longitude ?? undefined,
      location_context: profile.location_context || '',
      background: profile.background || '',
      inspiration_statement: profile.inspiration_statement || '',
      location: profile.location || '',
      avatar_url: profile.avatar_url || '',
      banner_url: profile.banner_url || '',
      website: profile.website || '',
      bitcoin_address: profile.bitcoin_address || '',
      lightning_address: profile.lightning_address || '',
    },
  });

  const getStepProgressInternal = useCallback(() => {
    const step = WIZARD_STEPS[currentStep];
    const stepFields = step.fields;
    const filledFields = stepFields.filter(field => {
      const value = form.getValues(field as keyof ProfileFormValues);
      return value !== null && value !== undefined && value !== '';
    });
    return filledFields.length / stepFields.length;
  }, [currentStep, form]);

  const calculateProgress = useCallback(() => {
    const completedSteps = WIZARD_STEPS.slice(0, currentStep).length;
    const currentStepProgress = getStepProgressInternal();
    return Math.round(((completedSteps + currentStepProgress) / WIZARD_STEPS.length) * 100);
  }, [currentStep, getStepProgressInternal]);

  const getStepProgress = useCallback(() => {
    return getStepProgressInternal();
  }, [getStepProgressInternal]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const data = form.getValues();
      await onSave(data as ProfileFormData);
    } catch (error) {
      logger.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [form, onSave]);

  const handleNext = useCallback(async () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      await handleSave();
    }
  }, [currentStep, handleSave]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const canProceed = useCallback(() => {
    const step = WIZARD_STEPS[currentStep];
    // Only username is required, other fields are optional
    if (step.id === 'basics') {
      return !!form.getValues('username');
    }
    return true;
  }, [currentStep, form]);

  return {
    // State
    currentStep,
    isSaving,
    // Form
    form,
    steps: WIZARD_STEPS,
    currentStepData: WIZARD_STEPS[currentStep],
    // Actions
    handleNext,
    handlePrevious,
    handleSave,
    canProceed,
    calculateProgress,
    getStepProgress,
  };
}

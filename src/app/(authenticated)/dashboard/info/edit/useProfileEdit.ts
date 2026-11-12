import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { ROUTES } from '@/config/routes';
import { API_ROUTES } from '@/config/api-routes';
import type { Profile } from '@/types/profile';
import type { ProfileFormData } from '@/types/database';
import type { ProfileFieldType } from '@/lib/profile-guidance';
import { getProfileCompletionPercentage } from './profile-completion';
import { scrollBehavior } from '@/lib/scroll-behavior';

export function useProfileEdit() {
  const { user, profile: storeProfile, isLoading: authLoading } = useRequireAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [focusedField, setFocusedField] = useState<ProfileFieldType>(null);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [showMobileGuidance, setShowMobileGuidance] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (storeProfile) {
        setProfile(storeProfile as unknown as Profile);
        setCompletionPercentage(getProfileCompletionPercentage(storeProfile as unknown as Profile));
      }
      setIsLoading(false);
    }
  }, [storeProfile, authLoading]);

  useEffect(() => {
    if (profile) {
      setCompletionPercentage(getProfileCompletionPercentage(profile));
    }
  }, [profile]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash) {
      return;
    }
    const hash = window.location.hash.substring(1);
    const id = setTimeout(() => {
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
        const input = element.querySelector('input, textarea');
        if (input) {
          (input as HTMLElement).focus();
        }
      }
    }, 300);
    return () => clearTimeout(id);
  }, []);

  const handleSave = async (data: ProfileFormData) => {
    try {
      const response = await fetch(API_ROUTES.PROFILE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to save profile';
        let errorData;
        try {
          errorData = await response.json();
          logger.error('Profile save error response', errorData, 'Profile');
          if (errorData?.error) {
            if (typeof errorData.error === 'string') {
              errorMessage = errorData.error;
            } else if (errorData.error?.message) {
              errorMessage = errorData.error.message;
              if (errorData.error.details?.field) {
                errorMessage = `${errorData.error.details.field}: ${errorMessage}`;
              }
            } else {
              errorMessage = errorData.error.code || 'Validation error';
            }
          } else if (errorData?.message) {
            errorMessage = errorData.message;
          } else if (typeof errorData === 'string') {
            errorMessage = errorData;
          } else {
            errorMessage = JSON.stringify(errorData);
          }
        } catch (parseError) {
          logger.error('Failed to parse error response', parseError, 'Profile');
          errorMessage = response.statusText || `HTTP ${response.status}: Failed to save profile`;
        }
        logger.error(
          'Profile save failed',
          { status: response.status, errorData, errorMessage, sentData: data },
          'Profile'
        );
        throw new Error(errorMessage);
      }

      const updatedResponse = await fetch(API_ROUTES.PROFILE);
      if (updatedResponse.ok) {
        const result = await updatedResponse.json();
        if (result.success && result.data) {
          setProfile(result.data);
          useAuthStore.getState().fetchProfile();
        }
      }

      toast.success('Profile saved successfully! 💾', {
        description: 'Your profile has been updated',
        duration: 3000,
      });
      router.push(ROUTES.DASHBOARD.INFO);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save profile');
      throw error;
    }
  };

  const handleCancel = () => router.push(ROUTES.DASHBOARD.INFO);

  return {
    user,
    profile,
    isLoading: authLoading || isLoading,
    focusedField,
    setFocusedField,
    completionPercentage,
    showMobileGuidance,
    setShowMobileGuidance,
    handleSave,
    handleCancel,
  };
}

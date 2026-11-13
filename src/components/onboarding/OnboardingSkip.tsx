'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { ONBOARDING_METHOD } from '@/config/onboarding';
import { ProfileService } from '@/services/profile';
import { logger } from '@/utils/logger';

/**
 * The way out for someone who does not want to write a bio now. `/` sends
 * anyone whose onboarding is unfinished back to this flow, so the skip is
 * recorded on the profile before leaving — otherwise every visit to the home
 * page would bring them back to "Tell Cat who you are".
 */
export function OnboardingSkip({ userId }: { userId: string | undefined }) {
  const router = useRouter();
  const [isLeaving, setIsLeaving] = useState(false);

  const handleSkip = async () => {
    setIsLeaving(true);
    if (userId) {
      const result = await ProfileService.fallbackProfileUpdate(userId, {
        onboarding_completed: true,
        onboarding_method: ONBOARDING_METHOD.SKIPPED,
      });
      if (!result.success) {
        logger.error('Failed to record skipped onboarding', result.error, 'OnboardingSkip');
      }
    }
    router.push(ROUTES.DASHBOARD.CAT);
  };

  return (
    <button
      type="button"
      data-testid="onboarding-skip"
      onClick={() => void handleSkip()}
      disabled={isLeaving}
      className="min-h-11 text-sm text-fg-secondary transition-colors hover:text-fg-primary disabled:opacity-50"
    >
      Skip for now
    </button>
  );
}

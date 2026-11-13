/**
 * ONBOARDING NAVIGATION COMPONENT
 * Previous/Next buttons for wizard navigation
 */

import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';

interface OnboardingNavigationProps {
  currentStep: number;
  totalSteps: number;
  canProceed: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onNext: () => void;
}

export function OnboardingNavigation({
  currentStep,
  totalSteps,
  canProceed,
  isSubmitting,
  onBack,
  onNext,
}: OnboardingNavigationProps) {
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="flex items-center justify-between pt-8 border-t border-default">
      <Button variant="outline" onClick={onBack} disabled={currentStep === 0}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Previous
      </Button>

      <Button onClick={onNext} disabled={!canProceed || isSubmitting} variant="primary">
        {isLastStep ? (
          <>
            Complete Setup
            <Sparkles className="w-4 h-4 ml-2" />
          </>
        ) : (
          <>
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
}

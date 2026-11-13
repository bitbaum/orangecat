/**
 * ONBOARDING HEADER COMPONENT
 * Header with progress bar and navigation
 */

import { useRouter } from 'next/navigation';
import { Bot } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Progress } from '@/components/ui/progress';
import { ROUTES } from '@/config/routes';

interface OnboardingHeaderProps {
  currentStep: number;
  totalSteps: number;
  currentStepTitle: string;
  progress: number;
}

export function OnboardingHeader({
  currentStep,
  totalSteps,
  currentStepTitle,
  progress,
}: OnboardingHeaderProps) {
  const router = useRouter();

  return (
    <>
      {/* Header */}
      <div className="bg-surface-base border-b border-default">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Bot className="w-8 h-8 text-fg-primary" />
              <div>
                <h1 className="text-xl font-bold text-fg-primary">Set Up My AI</h1>
                <p className="text-sm text-fg-secondary">
                  Step {currentStep + 1} of {totalSteps}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => router.push(ROUTES.SETTINGS_AI)}>
              Skip for Now
            </Button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-surface-base border-b border-default">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-fg-primary">{currentStepTitle}</span>
              <span className="text-sm text-fg-secondary">{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} aria-label="Setup progress" className="h-2" />
          </div>
        </div>
      </div>
    </>
  );
}

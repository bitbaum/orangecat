'use client';

import { Check } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { WizardStep } from './types';

interface WizardProgressBarProps {
  wizardSteps: WizardStep[];
  currentStep: number;
  completedSteps: Set<number>;
  progress: number;
  onStepClick: (index: number) => void;
}

export function WizardProgressBar({
  wizardSteps,
  currentStep,
  completedSteps,
  progress,
  onStepClick,
}: WizardProgressBarProps) {
  const currentStepConfig = wizardSteps[currentStep];

  return (
    <div className="max-w-4xl mx-auto mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-fg-primary">
          Step {currentStep + 1} of {wizardSteps.length}
        </span>
        <div className="flex items-center gap-2">
          {currentStepConfig?.optional && (
            <Badge variant="secondary" className="text-xs">
              Optional
            </Badge>
          )}
        </div>
      </div>
      <Progress
        value={progress}
        aria-label="Progress"
        getValueLabel={() => `Step ${currentStep + 1} of ${wizardSteps.length}`}
        className="h-2 bg-surface-raised"
      />

      <div className="flex justify-between mt-3">
        {wizardSteps.map((step, index) => {
          const isCompleted = completedSteps.has(index);
          const isCurrent = index === currentStep;
          const isAccessible = index <= currentStep || completedSteps.has(index);

          return (
            <button
              key={step.id}
              onClick={() => onStepClick(index)}
              disabled={!isAccessible}
              aria-current={isCurrent ? 'step' : undefined}
              className={`flex flex-col items-center gap-2 transition-all ${
                isAccessible ? 'cursor-pointer' : 'cursor-not-allowed'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                  isCompleted
                    ? 'bg-status-positive text-fg-inverted'
                    : isCurrent
                      ? 'bg-fg-primary text-fg-inverted'
                      : 'bg-surface-raised text-fg-secondary'
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              <span
                className={`max-w-[64px] text-center text-xs font-medium leading-tight sm:max-w-[80px] ${
                  isCurrent ? 'text-fg-primary' : 'text-fg-secondary'
                }`}
              >
                {step.title.split(' (')[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

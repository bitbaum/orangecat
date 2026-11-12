/**
 * STEP NAVIGATION COMPONENT
 * Visual step indicators with progress
 */

import { CheckCircle } from 'lucide-react';
import type { WizardStep } from '../types';

interface StepNavigationProps {
  steps: WizardStep[];
  currentStep: number;
}

export function StepNavigation({ steps, currentStep }: StepNavigationProps) {
  return (
    <div className="px-6 py-6 bg-surface-raised/30 border-b relative">
      <div className="flex items-center justify-between max-w-2xl mx-auto relative">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;

          return (
            <div key={step.id} className="flex-1 flex flex-col items-center relative">
              {/* Step Circle */}
              <div
                className={`relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ${
                  isCompleted
                    ? 'bg-status-positive border-status-positive text-fg-inverted shadow-sm'
                    : isCurrent
                      ? 'bg-fg-primary border-fg-primary text-fg-inverted shadow-sm animate-pulse'
                      : isUpcoming
                        ? 'bg-surface-base border-strong text-fg-tertiary'
                        : 'bg-surface-raised border-strong text-fg-secondary'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <span className="text-lg">{step.title.split(' ')[0]}</span>
                )}

                {/* Priority indicator */}
                {step.required && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-status-negative rounded-full border border-fg-inverted" />
                )}
              </div>

              {/* Step Title */}
              <div className="mt-3 text-center">
                <div
                  className={`text-sm font-semibold transition-colors ${
                    isCompleted
                      ? 'text-status-positive'
                      : isCurrent
                        ? 'text-fg-primary'
                        : 'text-fg-secondary'
                  }`}
                >
                  {step.title.split(' ').slice(1).join(' ')}
                </div>
                <div
                  className={`text-xs mt-1 transition-colors ${
                    isCompleted
                      ? 'text-status-positive'
                      : isCurrent
                        ? 'text-fg-primary'
                        : 'text-fg-tertiary'
                  }`}
                >
                  {isCompleted
                    ? '✓ Complete'
                    : isCurrent
                      ? 'In Progress'
                      : step.required
                        ? 'Required'
                        : 'Optional'}
                </div>
              </div>

              {/* Connection Line */}
              {index < steps.length - 1 && (
                <div
                  className={`absolute top-6 left-1/2 w-full h-0.5 transition-colors ${
                    isCompleted ? 'bg-status-positive' : 'bg-border-strong'
                  }`}
                  style={{
                    width: 'calc(100% - 3rem)',
                    left: 'calc(50% + 1.5rem)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Current Step Description */}
      <div className="mt-6 text-center max-w-md mx-auto">
        <p className="text-sm text-fg-secondary leading-relaxed">
          {steps[currentStep].description}
        </p>
        {steps[currentStep].required && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-md border border-status-negative/20 bg-status-negative/10 px-2 py-1 text-xs text-status-negative">
            <span aria-hidden="true">!</span>
            <span>This step is required to continue</span>
          </div>
        )}
      </div>
    </div>
  );
}

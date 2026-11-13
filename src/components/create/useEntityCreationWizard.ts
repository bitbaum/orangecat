'use client';

import { useState, useCallback, useMemo } from 'react';
import type { EntityConfig, EntityTemplate, WizardStep } from './types';

interface UseEntityCreationWizardOptions<T extends Record<string, unknown>> {
  config: EntityConfig<T>;
  initialData?: Partial<T>;
}

/**
 * State for a create page: the steps (when the entity has a wizard) and the
 * template the person picked, if any.
 *
 * The form always comes first. Templates used to be a gate in front of it — a
 * full page of cards with "Start from scratch" pre-ticked and no Continue on
 * ten entity types, and a step of its own in the project wizard. They are now
 * an offer the person opens when they want one ("Start from a template"), and
 * picking one fills only the fields they have not touched yet
 * (useEntityFormState merges a new baseline over a dirty form).
 */
export function useEntityCreationWizard<T extends Record<string, unknown>>({
  config,
  initialData,
}: UseEntityCreationWizardOptions<T>) {
  const wizardSteps = useMemo(
    (): WizardStep[] =>
      config.wizardConfig?.enabled ? [...(config.wizardConfig.steps ?? [])] : [],
    [config]
  );

  const templates = (config.templates ?? []) as EntityTemplate<T>[];

  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [selectedTemplate, setSelectedTemplate] = useState<EntityTemplate<T> | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Partial<T> | undefined>(initialData);

  const currentStepConfig = wizardSteps[currentStep];
  const progress = wizardSteps.length ? ((currentStep + 1) / wizardSteps.length) * 100 : 0;
  const isLastStep = currentStep === wizardSteps.length - 1;

  const handleNext = useCallback(() => {
    if (currentStep < wizardSteps.length - 1) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, wizardSteps.length]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    if (currentStepConfig?.optional) {
      handleNext();
    }
  }, [currentStepConfig?.optional, handleNext]);

  const handleStepClick = useCallback(
    (stepIndex: number) => {
      if (stepIndex <= currentStep || completedSteps.has(stepIndex)) {
        setCurrentStep(stepIndex);
      }
    },
    [currentStep, completedSteps]
  );

  /**
   * A template's defaults on top of whatever the page arrived with (a Cat
   * draft, a deep link). Switching templates replaces the previous template's
   * defaults rather than stacking them.
   */
  const handleTemplateSelect = useCallback(
    (template: EntityTemplate<T> | null) => {
      setSelectedTemplate(template);
      setFormInitialValues(
        template?.defaults ? ({ ...initialData, ...template.defaults } as Partial<T>) : initialData
      );
    },
    [initialData]
  );

  return {
    wizardSteps,
    templates,
    currentStep,
    completedSteps,
    selectedTemplate,
    formInitialValues,
    currentStepConfig,
    progress,
    isLastStep,
    handleNext,
    handlePrevious,
    handleSkip,
    handleStepClick,
    handleTemplateSelect,
  };
}

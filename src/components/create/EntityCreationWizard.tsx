'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { ActorSelector } from './ActorSelector';
import { canCreateForSomeoneElse, OWNER_ME, type CreateOwner } from './owner';
import { CreateTemplateOffer } from './CreateTemplateOffer';
import { EntityForm } from './EntityForm';
import { FormHeader } from './EntityForm/components/FormHeader';
import { WizardProgressBar } from './WizardProgressBar';
import { useEntityCreationWizard } from './useEntityCreationWizard';
import type { EntityConfig } from './types';

interface EntityCreationWizardProps<T extends Record<string, unknown>> {
  config: EntityConfig<T>;
  initialData?: Partial<T>;
  onSuccess?: (data: T & { id: string }) => void;
}

/**
 * Every create page: the form first, with the owner picker and (where the
 * type has templates) "Start from a template" in the one page header.
 *
 * The step-by-step wizard (projects) and the single-page form share that
 * header — FormHeader, which is PageHeader — so the two no longer have two
 * different title sizes and two different ways back.
 */
export function EntityCreationWizard<T extends Record<string, unknown>>({
  config,
  initialData,
  onSuccess,
}: EntityCreationWizardProps<T>) {
  const {
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
  } = useEntityCreationWizard({ config, initialData });

  // Who will own the thing being created (ADR-0004 D8). `me` is the default;
  // a group actor is validated server-side by resolveCreationActor; "someone
  // else" is not an actor at all and redirects the submit into a claim.
  const [owner, setOwner] = useState<CreateOwner>(OWNER_ME);
  const allowSomeoneElse = canCreateForSomeoneElse(config.type);

  const headerActions = (
    <div className="flex flex-wrap items-center gap-3">
      <CreateTemplateOffer
        templates={templates}
        selectedTemplateId={selectedTemplate?.id ?? null}
        onSelectTemplate={handleTemplateSelect}
      />
      <ActorSelector value={owner} onChange={setOwner} allowSomeoneElse={allowSomeoneElse} />
    </div>
  );

  if (!config.wizardConfig?.enabled || wizardSteps.length === 0) {
    return (
      <EntityForm
        config={config}
        initialValues={formInitialValues}
        onSuccess={onSuccess}
        owner={owner}
        headerActions={headerActions}
      />
    );
  }

  return (
    <div className="bg-surface-page min-h-screen p-4 sm:p-6 lg:p-8">
      <FormHeader
        className="max-w-4xl mx-auto mb-6"
        name={config.name}
        namePlural={config.namePlural}
        pageDescription={config.pageDescription}
        backUrl={config.backUrl}
        mode="create"
        actions={headerActions}
      />

      <WizardProgressBar
        wizardSteps={wizardSteps}
        currentStep={currentStep}
        completedSteps={completedSteps}
        progress={progress}
        onStepClick={handleStepClick}
      />

      <div className="max-w-4xl mx-auto">
        {/*
          One EntityForm instance for every step: remounting it per step wiped
          entered fields (live dogfood 2026-09-06). Steps only swap
          visibleFields via wizardMode. No card header: the progress bar names
          the step and each field group carries its own heading, so a step
          showed its heading twice ("Basic Info" over "Basic Information").
        */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <EntityForm
              config={config}
              initialValues={formInitialValues}
              onSuccess={onSuccess}
              owner={owner}
              wizardMode={{
                currentStep,
                totalSteps: wizardSteps.length,
                visibleFields: currentStepConfig.fields,
                onNext: !isLastStep ? handleNext : undefined,
                onPrevious: currentStep > 0 ? handlePrevious : undefined,
                // Skip means "next step": on the last one there is none, and the
                // button did nothing beside "Create".
                onSkip: currentStepConfig.optional && !isLastStep ? handleSkip : undefined,
                isLastStep,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ActorSelector } from './ActorSelector';
import { canCreateForSomeoneElse, OWNER_ME, type CreateOwner } from './owner';
import { EntityForm } from './EntityForm';
import { WizardTemplatePicker } from './templates/WizardTemplatePicker';
import { WizardProgressBar } from './WizardProgressBar';
import { WizardTemplateOnlyView } from './WizardTemplateOnlyView';
import { useEntityCreationWizard } from './useEntityCreationWizard';
import type { EntityConfig, EntityTemplate } from './types';

// The four colorTheme values that ENTITY_REGISTRY exposes used to drive a
// per-entity chromatic palette in the wizard progress bar (amber, emerald,
// rose, etc). The rebrand collapses entity surfaces to monochrome chrome +
// one warm accent for top-of-funnel conversion (see CLAUDE.md design system).
// The progress bar now renders that warm accent uniformly — completed steps
// stay status-positive — and consumers no longer need to pass a theme prop.
const WIZARD_STEP_VARIANTS = {
  enter: (direction: number) => ({
    x: direction > 0 ? 1000 : -1000,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 1000 : -1000,
    opacity: 0,
  }),
};

interface EntityCreationWizardProps<T extends Record<string, unknown>> {
  config: EntityConfig<T>;
  initialData?: Partial<T>;
  onSuccess?: (data: T & { id: string }) => void;
  onCancel?: () => void;
}

export function EntityCreationWizard<T extends Record<string, unknown>>({
  config,
  initialData,
  onSuccess,
  onCancel,
}: EntityCreationWizardProps<T>) {
  const {
    wizardSteps,
    isTemplateOnlyMode,
    currentStep,
    completedSteps,
    selectedTemplate,
    formInitialValues,
    showTemplateSelection,
    currentStepConfig,
    progress,
    isTemplateStep,
    isLastStep,
    handleNext,
    handlePrevious,
    handleSkip,
    handleStepClick,
    handleTemplateSelect,
    handleTemplateOnlySelect,
    handleCancel,
  } = useEntityCreationWizard({ config, initialData, onSuccess, onCancel });

  // Who will own the thing being created (ADR-0004 D8). `me` is the default;
  // a group actor is validated server-side by resolveCreationActor; "someone
  // else" is not an actor at all and redirects the submit into a claim.
  const [owner, setOwner] = useState<CreateOwner>(OWNER_ME);
  const allowSomeoneElse = canCreateForSomeoneElse(config.type);

  const ownerSelector = (
    <ActorSelector
      value={owner}
      onChange={setOwner}
      allowSomeoneElse={allowSomeoneElse}
      className="ml-auto"
    />
  );

  if (showTemplateSelection && isTemplateOnlyMode) {
    return (
      <WizardTemplateOnlyView
        config={config}
        onCancel={handleCancel}
        onSelectTemplate={handleTemplateOnlySelect}
      />
    );
  }

  if (!config.wizardConfig?.enabled || wizardSteps.length === 0) {
    // The owner selector used to live only in the wizard branch below, so it
    // appeared on 1 of 13 entity types — and groups, which is what a bar is,
    // were in this branch. It renders here too now.
    return (
      <div>
        <div className="mx-auto mb-3 flex max-w-4xl flex-wrap items-center gap-3">
          {ownerSelector}
        </div>
        <EntityForm
          config={config}
          initialValues={formInitialValues || initialData}
          onSuccess={onSuccess}
          owner={owner}
        />
      </div>
    );
  }

  return (
    <div className="bg-surface-page min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto mb-3">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <button
            onClick={handleCancel}
            className="inline-flex items-center text-fg-secondary hover:text-fg-primary transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Cancel
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-fg-primary">{config.pageTitle}</h1>
          {ownerSelector}
        </div>
        <p className="text-sm text-fg-secondary ml-12">{config.pageDescription}</p>
      </div>

      <WizardProgressBar
        wizardSteps={wizardSteps}
        currentStep={currentStep}
        completedSteps={completedSteps}
        progress={progress}
        onStepClick={handleStepClick}
      />

      <div className="max-w-4xl mx-auto">
        {/*
          Keep EntityForm mounted across content steps. key={currentStep} on the
          animated wrapper remounted the form on every Next and wiped entered
          fields (live dogfood 2026-09-06: Create Project submitted empty / no-op).
          Template step stays animated; content steps share one form instance and
          only swap visibleFields via wizardMode.
        */}
        {isTemplateStep ? (
          <AnimatePresence mode="wait" custom={currentStep}>
            <motion.div
              key="template"
              custom={currentStep}
              variants={WIZARD_STEP_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: 'spring', stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
              }}
            >
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-6 w-6 text-fg-primary" />
                    <div>
                      <CardTitle>{currentStepConfig.title}</CardTitle>
                      <CardDescription>{currentStepConfig.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <WizardTemplatePicker
                      templates={(config.templates || []) as EntityTemplate<T>[]}
                      onSelectTemplate={handleTemplateSelect}
                      selectedTemplateId={selectedTemplate?.id}
                      showStartFromScratch
                      entityLabel={config.pageTitle?.replace(/^Create\s+/i, '')}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        ) : (
          <Card className="mb-6">
            <CardHeader>
              <div>
                <CardTitle>{currentStepConfig.title}</CardTitle>
                <CardDescription>{currentStepConfig.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
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
                  onSkip: currentStepConfig.optional ? handleSkip : undefined,
                  isLastStep,
                }}
              />
            </CardContent>
          </Card>
        )}

        {isTemplateStep && (
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 0}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            <div className="flex gap-3">
              {currentStepConfig.optional && (
                <Button variant="ghost" onClick={handleSkip}>
                  Skip
                </Button>
              )}

              <Button onClick={handleNext}>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import type { CreateOwner } from '../owner';
import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserCurrency } from '@/hooks/useUserCurrency';
import Loading from '@/components/Loading';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

import { GuidancePanel } from '../GuidancePanel';
import { AIPrefillBar } from '../AIPrefillBar';
import type { EntityConfig } from '../types';
import { FORM_THEME } from '@/config/theme-colors';

import { EntityCreationSuccess } from '../EntityCreationSuccess';
import { useEntityFormState } from './hooks/useEntityFormState';
import { formatRelativeTime } from './hooks/useEntityFormDraft';
import { useFieldVisibility } from './hooks/useFieldVisibility';
import { useEntityFormSubmit } from './hooks/useEntityFormSubmit';
import { FormHeader } from './components/FormHeader';
import { FormInfoBanner } from './components/FormInfoBanner';
import { FormActions } from './components/FormActions';
import { FormFieldGroups } from './components/FormFieldGroups';

export interface WizardMode {
  currentStep: number;
  totalSteps: number;
  visibleFields: string[];
  onNext?: () => void;
  onPrevious?: () => void;
  onSkip?: () => void;
  isLastStep?: boolean;
}

interface EntityFormProps<T extends Record<string, unknown>> {
  config: EntityConfig<T>;
  initialValues?: Partial<T>;
  onSuccess?: (data: T & { id: string }) => void;
  onError?: (error: string) => void;
  mode?: 'create' | 'edit';
  entityId?: string;
  wizardMode?: WizardMode;
  /** When true, removes page-level wrapper (min-h-screen, FormHeader) for embedding in dialogs */
  embedded?: boolean;
  /**
   * Actor that will own the created entity. `null` = personal actor. Group
   * actor IDs are validated server-side (resolveCreationActor) — invalid
   * IDs return 403.
   */
  /** Who will own it (ADR-0004 D8). Defaults to the signed-in user. */
  owner?: CreateOwner;
}

export function EntityForm<T extends Record<string, unknown>>({
  config,
  initialValues,
  onSuccess,
  onError,
  mode = 'create',
  entityId,
  wizardMode,
  embedded,
  owner,
}: EntityFormProps<T>) {
  const { user, isLoading: authLoading, hydrated } = useAuth();
  const userCurrency = useUserCurrency();

  const {
    formState,
    initialFormData,
    aiGeneratedFields,
    lastSavedAt,
    handleFieldChange,
    handleFieldFocus,
    handleAIPrefill,
    clearDraft,
    setSubmitting,
    setErrors,
    validateField,
  } = useEntityFormState({ config, initialValues, userCurrency, userId: user?.id, mode });

  const [createdEntity, setCreatedEntity] = useState<{ id: string; title: string } | null>(null);

  // Flat field list for the AI bar: it offers only the adjustments this form's
  // fields support, and names changed fields by their label.
  const aiAssistFields = useMemo(
    () => config.fieldGroups.flatMap(group => group.fields ?? []),
    [config.fieldGroups]
  );

  const handleFieldBlur = useCallback(
    (fieldName: string) => validateField(fieldName),
    [validateField]
  );

  const { isFieldVisible, isGroupVisible, visibleFieldGroups } = useFieldVisibility({
    formData: formState.data,
    fieldGroups: config.fieldGroups,
    wizardMode,
  });

  const { handleSubmit } = useEntityFormSubmit({
    config,
    formState,
    mode,
    entityId,
    user,
    onSuccess,
    onError,
    clearDraft,
    setSubmitting,
    setErrors,
    onEntityCreated: setCreatedEntity,
    handleFieldChange,
    wizardMode,
    owner,
  });

  /**
   * What the AI must not overwrite — only what the user actually put there.
   *
   * On create the form is already full of schema defaults ("other", "daily",
   * a currency), and the prefill service treats any non-empty value as
   * something the user typed and refuses to replace it. That silently reduced
   * "fill this form from my sentence" to "fill whichever fields happened to
   * start empty": saying "rent out my apartment in Basel for 1800 a month"
   * set Title and Location, then left Asset Type on "Other" and the rental
   * period on "daily" — contradicting the sentence they came from.
   *
   * Sending only fields that differ from their initial value keeps the
   * protection where it belongs (a value the user really did type) without
   * letting a default masquerade as one. On edit every value is genuinely the
   * entity's, so the whole record passes through unchanged.
   */
  const aiExistingData = useMemo(() => {
    if (mode === 'edit') {
      return formState.data;
    }
    const touched: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(formState.data as Record<string, unknown>)) {
      const initial = (initialFormData as Record<string, unknown>)[key];
      if (JSON.stringify(value) !== JSON.stringify(initial)) {
        touched[key] = value;
      }
    }
    return touched;
  }, [mode, formState.data, initialFormData]);

  if (!hydrated || authLoading) {
    return <Loading fullScreen message="Loading..." />;
  }
  if (!user) {
    return null;
  }

  if (createdEntity) {
    return (
      <EntityCreationSuccess
        entityType={config.type}
        entityId={createdEntity.id}
        entityTitle={createdEntity.title}
        entityTypeName={config.name}
        dashboardUrl={config.backUrl}
        detailUrl={config.successUrl
          .replace(/:id/g, createdEntity.id)
          .replace(/\[id\]/g, createdEntity.id)}
      />
    );
  }

  const Icon = config.icon;
  const theme = FORM_THEME[config.colorTheme];

  /**
   * FORM WIDTH SSOT
   *
   * Two layout modes, one rule: the form fields always get the full width of
   * a single comfortable content column — never a fraction of one.
   *
   * - Hosted (wizard step / embedded dialog): the host already provides the
   *   card + width. Render the bare form so fields span the host's content
   *   width. (Previously this branch kept a `lg:grid-cols-3` + `col-span-2`
   *   grid whose third column — the GuidancePanel — is never rendered in
   *   wizard mode, cramping every input to ~2/3 of an already-nested card.)
   * - Full page (create without wizard / edit): a max-w-6xl shell where the
   *   form card takes 2/3 (~3xl of fields) and the GuidancePanel 1/3.
   */
  const formElement = (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Cat-powered prefill on EVERY form — create and edit alike — so
                    users can describe what they want (or the change they want)
                    and have the fields filled instead of typing each one. On edit
                    the bar refines the existing values (it receives existingData). */}
      <AIPrefillBar
        formType={config.type}
        onPrefill={handleAIPrefill}
        disabled={formState.isSubmitting}
        existingData={aiExistingData}
        mode={mode}
        fields={aiAssistFields}
      />

      <FormFieldGroups
        visibleFieldGroups={visibleFieldGroups}
        isGroupVisible={isGroupVisible}
        isFieldVisible={isFieldVisible}
        formState={formState}
        handleFieldChange={handleFieldChange}
        handleFieldFocus={handleFieldFocus}
        handleFieldBlur={handleFieldBlur}
        aiGeneratedFields={aiGeneratedFields}
      />

      {config.infoBanner && <FormInfoBanner banner={config.infoBanner} />}

      {formState.errors.general && (
        <div className="oc-error-surface">
          <p className="text-sm">{formState.errors.general}</p>
        </div>
      )}

      {/* No in-form template panel: templates live ONLY in the wizard's step-1
          picker. A second "Need inspiration?" panel inside the form duplicated
          that step and could silently overwrite fields already filled in. */}

      <FormActions
        isSubmitting={formState.isSubmitting}
        mode={mode}
        entityName={config.name}
        backUrl={config.backUrl}
        theme={theme}
        wizardMode={wizardMode}
        lastSavedAt={lastSavedAt}
        formatRelativeTime={formatRelativeTime}
      />
    </form>
  );

  // Hosted mode: wizard step card or dialog owns the chrome — bare form,
  // full width of the host's content column.
  if (wizardMode || embedded) {
    return formElement;
  }

  return (
    <div className={`min-h-screen ${theme.pageSurface} p-4 sm:p-6 lg:p-8 pb-24 md:pb-8`}>
      <FormHeader
        icon={Icon}
        colorTheme={config.colorTheme}
        name={config.name}
        namePlural={config.namePlural}
        pageDescription={config.pageDescription}
        backUrl={config.backUrl}
        mode={mode}
      />

      <div className="max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{mode === 'create' ? config.formTitle : `Edit ${config.name}`}</CardTitle>
              <CardDescription>
                {mode === 'create'
                  ? config.formDescription
                  : `Update your ${config.name.toLowerCase()} details.`}
              </CardDescription>
            </CardHeader>
            <CardContent>{formElement}</CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <GuidancePanel
            activeField={formState.activeField}
            guidanceContent={config.guidanceContent}
            defaultGuidance={config.defaultGuidance}
          />
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FormState, AIGeneratedFields, FieldConfidence, EntityConfig } from '../../types';
import { useEntityFormDraft } from './useEntityFormDraft';
import { slugify } from '@/utils/string';

interface UseEntityFormStateOptions<T extends Record<string, unknown>> {
  config: EntityConfig<T>;
  initialValues?: Partial<T>;
  userCurrency: string;
  userId?: string;
  mode: 'create' | 'edit';
}

export function useEntityFormState<T extends Record<string, unknown>>({
  config,
  initialValues,
  userCurrency,
  userId,
  mode,
}: UseEntityFormStateOptions<T>) {
  const initialFormData = useMemo(() => {
    let data = { ...config.defaultValues, ...initialValues } as T;
    if ('currency' in data && !initialValues?.currency) {
      if (data.currency === undefined || data.currency === null || data.currency === '') {
        (data as Record<string, unknown>).currency = userCurrency;
      }
    }
    if (config.deriveInitialValues) {
      data = { ...data, ...config.deriveInitialValues(data) };
    }
    return data;
  }, [config, initialValues, userCurrency]);

  const [formState, setFormState] = useState<FormState<T>>({
    data: initialFormData,
    errors: {},
    isSubmitting: false,
    isDirty: false,
    activeField: null,
  });

  const [aiGeneratedFields, setAiGeneratedFields] = useState<AIGeneratedFields>({
    fields: new Set<string>(),
    confidence: {},
  });

  useEffect(() => {
    setFormState(prev => {
      let data = { ...config.defaultValues, ...initialValues } as T;
      if (config.deriveInitialValues) {
        data = { ...data, ...config.deriveInitialValues(data) };
      }
      return {
        ...prev,
        data,
        errors: {},
        isDirty: false,
        activeField: null,
      };
    });
  }, [initialValues, config]);

  const { lastSavedAt, clearDraft } = useEntityFormDraft({
    mode,
    userId,
    config,
    formStateData: formState.data,
    setFormState,
    initialValues,
  });

  const handleFieldChange = useCallback(
    (field: keyof T, value: unknown) => {
      const updatedData = { ...formState.data, [field]: value };

      if (field === 'name' && config.type === 'group') {
        (updatedData as Record<string, unknown>).slug = slugify(value as string);
      }

      // Mode-toggle fields declare clearOnChange: reset the listed siblings so a
      // value entered under the previous mode never rides along invisibly.
      const fieldConfig = config.fieldGroups
        .flatMap(g => g.fields ?? [])
        .find(f => f.name === field);
      for (const sibling of fieldConfig?.clearOnChange ?? []) {
        (updatedData as Record<string, unknown>)[sibling] = null;
      }

      setFormState(prev => ({
        ...prev,
        data: updatedData,
        errors: { ...prev.errors, [field as string]: '' },
        isDirty: true,
      }));

      setAiGeneratedFields(prev => {
        if (prev.fields.has(field as string)) {
          const newFields = new Set(prev.fields);
          newFields.delete(field as string);
          const newConfidence = { ...prev.confidence };
          delete newConfidence[field as string];
          return { fields: newFields, confidence: newConfidence };
        }
        return prev;
      });
    },
    [formState.data, config.type, config.fieldGroups]
  );

  const handleFieldFocus = useCallback((field: string) => {
    setFormState(prev => ({ ...prev, activeField: field }));
  }, []);

  const handleAIPrefill = useCallback(
    (
      data: Record<string, unknown>,
      confidence: Record<string, FieldConfidence>,
      changedFields: string[]
    ) => {
      setFormState(prev => ({
        ...prev,
        data: { ...prev.data, ...data } as T,
        isDirty: true,
      }));
      // Highlight only what the AI actually wrote. `data` carries the whole
      // form (including the user's own untouched values), so keying off it
      // flagged every field as AI-generated.
      setAiGeneratedFields({ fields: new Set<string>(changedFields), confidence });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  const setSubmitting = useCallback((isSubmitting: boolean) => {
    setFormState(prev => ({ ...prev, isSubmitting }));
  }, []);

  const setErrors = useCallback((errors: Record<string, string>) => {
    setFormState(prev => ({ ...prev, errors, isSubmitting: false }));
  }, []);

  const validateField = useCallback(
    (fieldName: string) => {
      if (!config.validationSchema) {
        return;
      }
      const result = config.validationSchema.safeParse({
        ...config.defaultValues,
        ...formState.data,
      });
      if (!result.success) {
        const fieldError = result.error.issues.find(e => e.path[0] === fieldName);
        if (fieldError) {
          setFormState(prev => ({
            ...prev,
            errors: { ...prev.errors, [fieldName]: fieldError.message },
          }));
        }
      }
    },
    [config.validationSchema, config.defaultValues, formState.data]
  );

  return {
    formState,
    setFormState,
    aiGeneratedFields,
    setAiGeneratedFields,
    lastSavedAt,
    initialFormData,
    handleFieldChange,
    handleFieldFocus,
    handleAIPrefill,
    clearDraft,
    setSubmitting,
    setErrors,
    validateField,
  };
}

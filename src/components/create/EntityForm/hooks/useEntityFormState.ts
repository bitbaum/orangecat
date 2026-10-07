import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  const initialFormData = useMemo(
    () => buildInitialData(config, initialValues, userCurrency),
    [config, initialValues, userCurrency]
  );
  // The reset below must fill the currency too, but must NOT re-run when the
  // preference finishes loading — that would wipe what was typed meanwhile.
  const userCurrencyRef = useRef(userCurrency);
  useEffect(() => {
    userCurrencyRef.current = userCurrency;
  });

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

  // The initial data the form currently stands on — what "untouched" means.
  const baselineRef = useRef(initialFormData);
  const dataRef = useRef(formState.data);
  useEffect(() => {
    dataRef.current = formState.data;
  });

  useEffect(() => {
    setFormState(prev => {
      // Same builder as the first render. This reset used to skip the
      // currency fill, so `currency` went back to undefined right after mount:
      // the field still DISPLAYED the user's currency, the server stored CHF,
      // and the form no longer matched the draft hook's pristine snapshot —
      // so an untouched form wrote a "draft" over a real one (audit 2026-10-07).
      const data = buildInitialData(config, initialValues, userCurrencyRef.current);
      const previousBaseline = baselineRef.current;
      baselineRef.current = data;

      // New initial values on create are a template pick (the wizard keeps the
      // form mounted behind its template step). They used to replace the whole
      // form, so Previous → pick a template wiped everything typed, without a
      // word. A template now fills only what the person has not touched. On
      // edit, new initial values are the loaded entity: those replace.
      if (mode === 'create' && prev.isDirty) {
        const merged = { ...data } as Record<string, unknown>;
        for (const [key, value] of Object.entries(prev.data as Record<string, unknown>)) {
          if (!sameValue(value, (previousBaseline as Record<string, unknown>)[key])) {
            merged[key] = value;
          }
        }
        return { ...prev, data: merged as T, errors: {}, activeField: null };
      }

      return {
        ...prev,
        data,
        errors: {},
        isDirty: false,
        activeField: null,
      };
    });
  }, [initialValues, config, mode]);

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
      // Mode-toggle fields declare clearOnChange: reset the listed siblings so a
      // value entered under the previous mode never rides along invisibly.
      const fieldConfig = config.fieldGroups
        .flatMap(g => g.fields ?? [])
        .find(f => f.name === field);

      // Built from `prev`, not from the render's snapshot: several changes in
      // one tick (picking a wallet sets _wallet_id, bitcoin_address and
      // lightning_address) each started from the same stale data, and only
      // the last one survived.
      setFormState(prev => {
        const updatedData = { ...prev.data, [field]: value };
        if (field === 'name' && config.type === 'group') {
          (updatedData as Record<string, unknown>).slug = slugify(value as string);
        }
        for (const sibling of fieldConfig?.clearOnChange ?? []) {
          (updatedData as Record<string, unknown>)[sibling] = null;
        }
        return {
          ...prev,
          data: updatedData,
          errors: { ...prev.errors, [field as string]: '' },
          isDirty: true,
        };
      });

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
    [config.type, config.fieldGroups]
  );

  const handleFieldFocus = useCallback((field: string) => {
    setFormState(prev => ({ ...prev, activeField: field }));
  }, []);

  const handleAIPrefill = useCallback(
    (
      data: Record<string, unknown>,
      confidence: Record<string, FieldConfidence>,
      changedFields: string[],
      sent?: Record<string, unknown>
    ) => {
      // Apply only what the AI changed, and never over an edit made while it
      // was thinking. `data` echoes the snapshot the request was sent with, so
      // merging all of it put a title typed during those seconds back to what
      // it was (audit 2026-10-07). A field counts as edited meanwhile when it
      // no longer equals what was sent — or, for a field the snapshot left out
      // because it was still at its default, that default.
      // The latest committed form: the answer arrives seconds after the send,
      // long after any render that could have closed over the data.
      const current = dataRef.current as Record<string, unknown>;
      const baseline = baselineRef.current as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      const applied: string[] = [];
      for (const key of changedFields) {
        if (!(key in data)) {
          continue;
        }
        const atSend = sent && key in sent ? sent[key] : baseline[key];
        if (sent && !sameValue(current[key], atSend)) {
          continue;
        }
        patch[key] = data[key];
        applied.push(key);
      }
      setFormState(prev => ({ ...prev, data: { ...prev.data, ...patch } as T, isDirty: true }));
      // Highlight only what the AI actually wrote.
      setAiGeneratedFields({ fields: new Set<string>(applied), confidence });
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

function sameValue(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Defaults + supplied values, the user's currency where none is set, then
 *  derived values. The one builder for both the first render and a reset. */
function buildInitialData<T extends Record<string, unknown>>(
  config: { defaultValues: T; deriveInitialValues?: (data: T) => Partial<T> },
  initialValues: Partial<T> | undefined,
  userCurrency: unknown
): T {
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
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { formatRelativeTime } from '@/utils/dates';
import type { FormState, EntityConfig } from '../../types';

export { formatRelativeTime };

interface UseEntityFormDraftOptions<T extends Record<string, unknown>> {
  mode: 'create' | 'edit';
  userId?: string;
  config: EntityConfig<T>;
  formStateData: T;
  setFormState: React.Dispatch<React.SetStateAction<FormState<T>>>;
  initialValues?: Partial<T>;
}

export function useEntityFormDraft<T extends Record<string, unknown>>({
  mode,
  userId,
  config,
  formStateData,
  setFormState,
  initialValues,
}: UseEntityFormDraftOptions<T>) {
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // The form as it looked on first render (template/config defaults). Autosave
  // compares against this so a form nobody has touched never writes a draft —
  // untouched defaults used to count as "content" (status: 'draft' is a
  // non-empty string), which both minted junk drafts and let a fresh, pristine
  // form clobber a real saved draft within one autosave tick.
  const pristineRef = useRef<string | null>(null);
  if (pristineRef.current === null) {
    pristineRef.current = JSON.stringify(formStateData);
  }

  // Once the entity is created, the draft is done for good on this mount. The
  // autosave interval keeps ticking while the success screen shows, and the
  // submitted values are still in form state — without this latch, the tick
  // after clearDraft() re-saved the just-created entity as a "draft", and the
  // next visit to the create form offered the previous project back
  // (reproduced in production 2026-08-25: silently restoring it made every
  // field a duplicate of the project just made).
  const clearedRef = useRef(false);

  // Offer the draft at most once per mount, even if the effect re-runs.
  const offeredRef = useRef(false);

  useEffect(() => {
    if (mode === 'edit' || !userId || offeredRef.current) {
      return;
    }

    const hasInitialContent =
      initialValues &&
      (('title' in initialValues && initialValues.title) ||
        ('description' in initialValues && initialValues.description));

    const draftKey = `${config.type}-draft-${userId}`;
    if (hasInitialContent) {
      localStorage.removeItem(draftKey);
      return;
    }

    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const { formData, savedAt } = JSON.parse(savedDraft);
        const age = Date.now() - new Date(savedAt).getTime();
        if (age < 7 * 24 * 60 * 60 * 1000) {
          offeredRef.current = true;
          // OFFER the draft — never apply it unasked. Silent restore filled a
          // brand-new form with the previous entity's values; anyone who did
          // not notice the toast shipped a duplicate.
          toast.info(`You have a draft from ${formatRelativeTime(savedAt)}`, {
            description: 'Restore it, or start fresh and it will be replaced as you type.',
            duration: 10000,
            action: {
              label: 'Restore',
              onClick: () => {
                setFormState(prev => ({ ...prev, data: { ...prev.data, ...formData } }));
                setLastSavedAt(new Date(savedAt));
              },
            },
          });
        } else {
          localStorage.removeItem(draftKey);
        }
      } catch (error) {
        logger.error('Failed to parse draft', { error }, 'EntityForm');
        localStorage.removeItem(draftKey);
      }
    }
  }, [config.type, userId, mode, initialValues, setFormState]);

  useEffect(() => {
    if (mode === 'edit' || !userId) {
      return;
    }

    const interval = setInterval(() => {
      if (clearedRef.current) {
        return;
      }
      // Untouched since mount → nothing worth saving, and possibly a real
      // draft in storage worth NOT overwriting.
      if (JSON.stringify(formStateData) === pristineRef.current) {
        return;
      }

      const hasContent = Object.values(formStateData).some(v => {
        if (typeof v === 'string') {
          return v.trim().length > 0;
        }
        if (Array.isArray(v)) {
          return v.length > 0;
        }
        return v !== null && v !== undefined;
      });
      if (!hasContent) {
        return;
      }

      const draftKey = `${config.type}-draft-${userId}`;
      const savedAt = new Date().toISOString();
      localStorage.setItem(draftKey, JSON.stringify({ formData: formStateData, savedAt }));
      setLastSavedAt(new Date(savedAt));
    }, 10000);

    return () => clearInterval(interval);
  }, [formStateData, config.type, userId, mode]);

  const clearDraft = useCallback(() => {
    clearedRef.current = true;
    if (userId) {
      localStorage.removeItem(`${config.type}-draft-${userId}`);
    }
  }, [config.type, userId]);

  return { lastSavedAt, clearDraft };
}

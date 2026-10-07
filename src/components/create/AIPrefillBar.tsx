'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sparkles, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import { ApiResponseError, unwrapApiResponse } from '@/lib/api/client-response';
import { isAiErrorCode, type AiErrorCode } from '@/config/ai-errors';
import { AIPrefillFeedback } from './AIPrefillFeedback';

import { AIFillPanel } from './AIFillPanel';
import { AIRefinePanel } from './AIRefinePanel';
import type { AIPrefillBarProps, AIPrefillResponse } from './types';
import {
  AI_ASSIST_MIN_INPUT_LENGTH,
  getAdjustmentsForFields,
  getExampleDescriptions,
  type AiAdjustment,
  type AiAssistIntent,
} from '@/config/ai-form-assist';

const EMPTY_FIELDS: NonNullable<AIPrefillBarProps['fields']> = [];

/** Marks the free-text box as the in-flight request, so chips show their own spinner. */
const TYPED_REQUEST = '__typed__';

/**
 * AI assistance for any entity form — fill an empty one, or change a filled one.
 *
 * Owns the request lifecycle only; the two surfaces render in AIFillPanel /
 * AIRefinePanel.
 */
export function AIPrefillBar({
  formType,
  onPrefill,
  disabled = false,
  existingData,
  mode = 'create',
  fields = EMPTY_FIELDS,
}: AIPrefillBarProps) {
  const isEdit = mode === 'edit';
  // Seed the AI-fill box from a ?description= param on create — this is how the
  // onboarding "paste who you are → offers → Create this" flow lands a proposed
  // offering here ready to generate, closing the loop without retyping.
  const searchParams = useSearchParams();
  const [description, setDescription] = useState(() =>
    mode === 'create' ? (searchParams.get('description') ?? '') : ''
  );
  const [instruction, setInstruction] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * Set when the failure came from the AI itself, so it renders through
   * AiErrorNotice (cause + fix link + one-click report) instead of as bare
   * text. Validation feedback deliberately leaves this null: "describe the
   * change you want" is already actionable and needs no fix link.
   */
  const [errorCode, setErrorCode] = useState<AiErrorCode | null>(null);
  /** A partial fill's own words: the facts landed, the prose did not. */
  const [notice, setNotice] = useState<string | null>(null);

  /** Clear both halves of the error state together — a stale notice outliving
   *  its message is the kind of drift two separate resets invite. */
  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
    setNotice(null);
  }, []);
  const [hasFilled, setHasFilled] = useState(false);
  const [lastChanged, setLastChanged] = useState<string[] | null>(null);

  const examples = getExampleDescriptions(formType);

  // Filtered against THIS form's fields, so a form without a description never
  // offers to lengthen one.
  const adjustments = useMemo(() => getAdjustmentsForFields(fields), [fields]);

  /**
   * On edit the fields are already populated, so the bar starts in refine mode:
   * "change what's here" is the only sensible ask. On create it flips to refine
   * once the AI has filled the form.
   */
  const isRefineMode = isEdit || hasFilled;
  const busy = pending !== null;

  const labelFor = useCallback(
    (name: string) => fields.find(f => f.name === name)?.label ?? name,
    [fields]
  );

  const callAI = useCallback(
    async (prompt: string, intent: AiAssistIntent, requestId: string) => {
      setPending(requestId);
      clearError();
      setLastChanged(null);
      // What the server sees. The answer echoes it back, so it is also what
      // tells a field the AI changed from one the person changed meanwhile.
      const sent = existingData;

      try {
        const response = await fetch(API_ROUTES.AI.FORM_PREFILL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            formType,
            description: prompt.trim(),
            existingData: sent,
            intent,
          }),
        });

        const result = await unwrapApiResponse<
          Pick<AIPrefillResponse, 'data' | 'changedFields' | 'confidence' | 'notice'>
        >(response, 'Failed to generate form data');

        const changedFields = result.changedFields ?? Object.keys(result.data);
        onPrefill(result.data, result.confidence, changedFields, sent);
        setHasFilled(true);
        setLastChanged(changedFields);
        setNotice(result.notice ?? null);
        if (result.notice) {
          toast('Filled what your words say', { description: 'The AI prose is missing.' });
          return;
        }

        if (intent === 'refine') {
          setInstruction('');
          if (changedFields.length === 0) {
            toast('Nothing changed', { description: 'Try naming the field you want changed.' });
          } else {
            toast.success(
              `Updated ${changedFields.length} field${changedFields.length > 1 ? 's' : ''}`
            );
          }
        } else {
          toast.success('Form filled — review and adjust below');
        }
      } catch (err) {
        logger.error('AI prefill error', err, 'AI');
        const code = err instanceof ApiResponseError ? err.code : undefined;
        setErrorCode(isAiErrorCode(code) ? code : null);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setPending(null);
      }
    },
    [formType, existingData, onPrefill, clearError]
  );

  const handleGenerate = useCallback(() => {
    const min = AI_ASSIST_MIN_INPUT_LENGTH.fill;
    if (description.trim().length < min) {
      setError(`Please describe what you want to create (at least ${min} characters)`);
      return;
    }
    callAI(description, 'fill', TYPED_REQUEST);
  }, [description, callAI]);

  /**
   * Fill immediately when the description arrived from speech.
   *
   * Someone who just said "rent out my apartment in Basel for 1800 a month"
   * has already told us everything; landing them on their own words next to a
   * button to press is a step they did not ask for and would not expect. The
   * onboarding flow deliberately does NOT set this — there the description is
   * a proposal the user should read before committing to it — so the trigger
   * is opt-in via `?autofill=1` rather than "any description in the URL".
   */
  const autofillRequested = mode === 'create' && searchParams.get('autofill') === '1';
  const autofilled = useRef(false);
  useEffect(() => {
    if (!autofillRequested || autofilled.current || busy || hasFilled) {
      return;
    }
    if (description.trim().length < AI_ASSIST_MIN_INPUT_LENGTH.fill) {
      return;
    }
    autofilled.current = true;
    callAI(description, 'fill', TYPED_REQUEST);
  }, [autofillRequested, description, busy, hasFilled, callAI]);

  const handleRefine = useCallback(() => {
    if (instruction.trim().length < AI_ASSIST_MIN_INPUT_LENGTH.refine) {
      return;
    }
    callAI(instruction, 'refine', TYPED_REQUEST);
  }, [instruction, callAI]);

  const handleAdjust = useCallback(
    (adjustment: AiAdjustment) => callAI(adjustment.instruction, 'refine', adjustment.id),
    [callAI]
  );

  const handleDescriptionChange = useCallback(
    (value: string) => {
      setDescription(value);
      clearError();
    },
    [clearError]
  );

  const handleInstructionChange = useCallback(
    (value: string) => {
      setInstruction(value);
      clearError();
    },
    [clearError]
  );

  const handleReset = () => {
    setHasFilled(false);
    setDescription('');
    setInstruction('');
    clearError();
    setLastChanged(null);
  };

  const statusMessage =
    busy || lastChanged === null
      ? ''
      : lastChanged.length > 0
        ? `Updated: ${lastChanged.map(labelFor).join(', ')}`
        : 'No fields changed — try naming the field you want changed.';

  return (
    <div className="mb-6 space-y-3 rounded-md border border-subtle bg-surface-raised/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-fg-primary" />
          <span className="text-sm font-semibold text-fg-primary">
            {isEdit ? 'Edit with AI' : hasFilled ? 'AI filled the form' : 'Fill with AI'}
          </span>
          {hasFilled && !isEdit && (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-status-positive" />
          )}
        </div>
        {hasFilled && !isEdit && (
          <button
            type="button"
            onClick={handleReset}
            className="flex min-h-11 shrink-0 items-center gap-1 px-1 text-xs text-fg-secondary hover:text-fg-primary"
          >
            <RefreshCw className="h-3 w-3" />
            Start over
          </button>
        )}
      </div>

      {isRefineMode ? (
        <AIRefinePanel
          adjustments={adjustments}
          onAdjust={handleAdjust}
          instruction={instruction}
          onInstructionChange={handleInstructionChange}
          onSubmit={handleRefine}
          pending={pending}
          typedRequestId={TYPED_REQUEST}
          disabled={disabled}
        />
      ) : (
        <AIFillPanel
          description={description}
          onDescriptionChange={handleDescriptionChange}
          examples={examples}
          onSubmit={handleGenerate}
          busy={busy}
          disabled={disabled}
        />
      )}

      {/* What actually changed — the old bar reported success either way.
          A live region so it is announced, not merely visible. */}
      <p role="status" aria-live="polite" className="text-xs text-fg-secondary empty:hidden">
        {statusMessage}
      </p>

      <AIPrefillFeedback notice={notice} error={error} errorCode={errorCode} />
    </div>
  );
}

export default AIPrefillBar;

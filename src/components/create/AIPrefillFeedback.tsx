'use client';

import { AlertCircle } from 'lucide-react';
import type { AiErrorCode } from '@/config/ai-errors';
import { AiErrorNotice } from '@/components/ai/AiErrorNotice';

/**
 * What the AI fill has to say for itself, under the bar: the partial-fill
 * notice (the facts landed, the prose did not — a warning, the form is
 * usable), an AI error with its cause, fix and one-tap report, or plain
 * validation text. Split from AIPrefillBar at the 300-line component limit.
 */
export function AIPrefillFeedback({
  notice,
  error,
  errorCode,
}: {
  notice: string | null;
  error: string | null;
  errorCode: AiErrorCode | null;
}) {
  return (
    <>
      {notice && (
        <div className="flex items-start gap-2 text-xs text-status-warning" role="status">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {errorCode ? (
        <AiErrorNotice
          code={errorCode}
          context={{ surface: 'form-prefill', detail: error ?? undefined }}
        />
      ) : (
        error && (
          <div className="flex items-start gap-2 text-sm text-status-negative">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )
      )}
    </>
  );
}

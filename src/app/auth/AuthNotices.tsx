'use client';

import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';

/** What went wrong or right with the last attempt, above the form. */
export function AuthNotices({
  error,
  success,
  retryable,
  loading,
  onRetry,
  onDismiss,
}: {
  error: string | null;
  success: string | null;
  /** Whether "Try again" could change the outcome (authErrors.ts). */
  retryable: boolean;
  loading: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <>
      {error && (
        <div className="mb-6 p-4 rounded-lg oc-error-surface">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-status-negative mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-status-negative mb-3">{error}</p>
              <div className="flex gap-2">
                {/* Only where the same attempt could work a moment later
                    (the connection, the server): a wrong password retried
                    is the same wrong password. */}
                {retryable && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    disabled={loading}
                    className="text-status-negative border-status-negative-subtle hover:bg-status-negative/10"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try again
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  className="text-status-negative hover:bg-status-negative/10"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-lg bg-status-positive-subtle border border-status-positive/20">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-status-positive" />
            <p className="text-sm text-status-positive">{success}</p>
          </div>
        </div>
      )}
    </>
  );
}

/** The no-email way in, with the one line that says what it means. */
export function AnonymousEntry({
  variant,
  label,
  loading,
  disabled,
  onClick,
}: {
  variant: 'accent' | 'outline';
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <>
      <Button
        type="button"
        variant={variant}
        disabled={disabled}
        onClick={onClick}
        className="h-12 w-full font-semibold"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-label="Starting…" />
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            {label}
          </span>
        )}
      </Button>
      <p className="mb-0 mt-2 text-center text-xs text-fg-secondary">
        Explore pseudonymously. Add an email anytime to secure your account.
      </p>
    </>
  );
}

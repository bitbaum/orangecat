'use client';

import { useState, useCallback, useEffect } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

export interface TurnstileCaptchaProps {
  siteKey: string;
  onSuccess: (token: string) => void;
  onError?: (error: string) => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
  className?: string;
}

type CaptchaStatus = 'idle' | 'loading' | 'success' | 'error' | 'expired';

export function TurnstileCaptcha({
  siteKey,
  onSuccess,
  onError,
  onExpire,
  theme = 'auto',
  size = 'normal',
  className = '',
}: TurnstileCaptchaProps) {
  const [status, setStatus] = useState<CaptchaStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [turnstileInstance, setTurnstileInstance] = useState<TurnstileInstance | null>(null);

  // Callback ref to handle Turnstile instance
  const turnstileRef = useCallback((instance: TurnstileInstance | undefined | null) => {
    setTurnstileInstance(instance ?? null);
  }, []);

  const handleSuccess = useCallback(
    (token: string) => {
      setStatus('success');
      setErrorMessage(null);
      onSuccess(token);
    },
    [onSuccess]
  );

  const handleError = useCallback(
    (error?: string) => {
      const message = error || 'CAPTCHA verification failed';
      setStatus('error');
      setErrorMessage(message);
      onError?.(message);
    },
    [onError]
  );

  const handleExpire = useCallback(() => {
    setStatus('expired');
    setErrorMessage('CAPTCHA expired. Please verify again.');
    onExpire?.();
  }, [onExpire]);

  const handleRetry = useCallback(() => {
    setStatus('idle');
    setErrorMessage(null);
    turnstileInstance?.reset();
  }, [turnstileInstance]);

  // Show loading state while Turnstile loads
  useEffect(() => {
    if (status === 'idle') {
      setStatus('loading');
    }
  }, [status]);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-center min-h-[65px]">
        {status === 'success' ? (
          <div className="flex items-center space-x-2 text-status-positive bg-status-positive-subtle px-4 py-2 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">Verified</span>
          </div>
        ) : (
          <Turnstile
            ref={turnstileRef}
            siteKey={siteKey}
            onSuccess={handleSuccess}
            onError={() => handleError('Verification failed')}
            onExpire={handleExpire}
            options={{
              theme,
              size,
              language: 'auto',
            }}
          />
        )}
      </div>

      {/* Error state with retry */}
      {(status === 'error' || status === 'expired') && (
        <div className="flex items-center justify-between p-3 oc-error-surface rounded-lg">
          <div className="flex items-center space-x-2 text-status-negative">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center space-x-1 text-sm text-status-negative hover:text-status-negative/80 font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default TurnstileCaptcha;

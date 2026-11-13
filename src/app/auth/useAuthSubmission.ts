import { useState } from 'react';
import type { AuthFormData, AuthMode } from './useAuthForm';
import { resetPassword, getMFAAssuranceLevel } from '@/services/supabase/auth';
import { registrationEvents, trackEvent } from '@/lib/analytics';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import { API_ROUTES } from '@/config/api-routes';
import { returnCookie } from '@/lib/oauth/handoff';
import type { Session, User } from '@supabase/supabase-js';
import {
  describeAuthFailure,
  validateAuthFields,
  type AuthFailure,
  type AuthFieldErrors,
} from './authErrors';

/** A failure the person cannot fix by retrying the same attempt. */
class FinalAuthError extends Error {}

/** What the auth store's signIn/signUp resolve to. */
interface AuthAttempt {
  data: { user: User | null; session: Session | null } | null;
  error: Error | null;
}

interface UseAuthSubmissionOptions {
  formData: AuthFormData;
  mode: AuthMode;
  captchaEnabled: boolean;
  captchaToken: string | null;
  setCaptchaToken: (token: string | null) => void;
  setMode: (mode: AuthMode) => void;
  setShowMFAVerify: (show: boolean) => void;
  rememberMe: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<AuthAttempt>;
  signUp: (email: string, password: string) => Promise<AuthAttempt>;
  /** Where the person was headed (`from`), so a reset can send them back. */
  returnTo?: string | null;
}

export function useAuthSubmission({
  formData,
  mode,
  captchaEnabled,
  captchaToken,
  setCaptchaToken,
  setMode,
  setShowMFAVerify,
  rememberMe,
  signIn,
  signUp,
  returnTo = null,
}: UseAuthSubmissionOptions) {
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Whether "Try again" could change the outcome (authErrors.ts).
  const [retryable, setRetryable] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // No timer of our own: a slow sign-in is timed out by the auth service
  // (src/services/supabase/auth/operations.ts), which also releases the
  // store's loading flag. A second, shorter clock here showed an error while
  // every button was still disabled, then replaced it when the real one fired.

  const fail = (failure: AuthFailure) => {
    setError(failure.message);
    setRetryable(failure.retryable);
  };

  /** Field problems go under their fields; true when there were none. */
  const fieldsAreValid = () => {
    const problems = validateAuthFields(mode, formData);
    setFieldErrors(problems);
    return Object.keys(problems).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!fieldsAreValid()) {
      return;
    }
    setLocalLoading(true);

    try {
      if (mode === 'register') {
        if (captchaEnabled && !captchaToken) {
          throw new FinalAuthError('Please complete the check that you are human.');
        }

        if (captchaEnabled && captchaToken) {
          const captchaResponse = await fetch(API_ROUTES.AUTH.VERIFY_CAPTCHA, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: captchaToken }),
          });
          const captchaResult = await captchaResponse.json();
          if (!captchaResponse.ok || !captchaResult.success) {
            setCaptchaToken(null);
            throw new FinalAuthError(
              captchaResult?.error?.message ||
                'The check that you are human did not go through. Complete it again.'
            );
          }
        }
      }

      const result =
        mode === 'login'
          ? await signIn(formData.email, formData.password, rememberMe)
          : await signUp(formData.email, formData.password);

      if (result.error) {
        fail(describeAuthFailure(apiErrorMessage(result.error, '')));
        setRetryCount(prev => prev + 1);
        return;
      }

      if (mode === 'register' && result.data && !result.data.session) {
        registrationEvents.success({ email: formData.email });
        registrationEvents.emailSent({ email: formData.email });
        setSuccess(
          'Registration successful! Please check your email to verify your account before signing in.'
        );
        setCaptchaToken(null);
        setMode('login');
      } else if (result.data && result.data.user) {
        if (mode === 'login') {
          const mfaResult = await getMFAAssuranceLevel();
          if (
            mfaResult.data &&
            mfaResult.data.currentLevel === 'aal1' &&
            mfaResult.data.nextLevel === 'aal2'
          ) {
            setShowMFAVerify(true);
            setLocalLoading(false);
            return;
          }
        }
        trackEvent('login_success', { userId: result.data.user.id });
        setSuccess('Login successful! Redirecting...');
      }
    } catch (err) {
      const message = apiErrorMessage(err, 'An unexpected error occurred');
      fail(
        err instanceof FinalAuthError ? { message, retryable: false } : describeAuthFailure(message)
      );
      setRetryCount(prev => prev + 1);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!fieldsAreValid()) {
      return;
    }
    setLocalLoading(true);

    try {
      const cookie = returnCookie(returnTo);
      if (cookie) {
        document.cookie = cookie;
      }
      const result = await resetPassword({ email: formData.email });
      if (result.error) {
        throw new Error(apiErrorMessage(result.error, 'Failed to send reset email'));
      }
      setSuccess('Password reset email sent! Check your inbox and follow the instructions.');
    } catch (err) {
      fail(describeAuthFailure(apiErrorMessage(err, 'Failed to send password reset email')));
    } finally {
      setLocalLoading(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setError(null);
    setSuccess(null);
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    if (mode === 'forgot') {
      handleForgotPassword(fakeEvent);
    } else {
      handleSubmit(fakeEvent);
    }
  };

  const handleClearError = () => {
    setError(null);
    setFieldErrors({});
    setSuccess(null);
    setRetryCount(0);
  };

  return {
    localLoading,
    error,
    retryable,
    fieldErrors,
    setFieldErrors,
    success,
    retryCount,
    handleSubmit,
    handleForgotPassword,
    handleRetry,
    handleClearError,
  };
}

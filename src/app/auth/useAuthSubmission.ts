import { useState, useEffect } from 'react';
import type { AuthFormData, AuthMode } from './useAuthForm';
import { resetPassword, getMFAAssuranceLevel } from '@/services/supabase/auth';
import { registrationEvents, trackEvent } from '@/lib/analytics';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import { API_ROUTES } from '@/config/api-routes';

interface UseAuthSubmissionOptions {
  formData: AuthFormData;
  mode: AuthMode;
  captchaEnabled: boolean;
  captchaToken: string | null;
  setCaptchaToken: (token: string | null) => void;
  setMode: (mode: AuthMode) => void;
  setShowMFAVerify: (show: boolean) => void;
  rememberMe: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<any>;
  signUp: (email: string, password: string) => Promise<any>;
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
}: UseAuthSubmissionOptions) {
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (localLoading) {
      const timeout = Math.min(15000 + retryCount * 5000, 45000);
      const timer = setTimeout(() => {
        setLocalLoading(false);
        setError(
          'Authentication request timed out. This usually means environment variables are not configured properly.'
        );
      }, timeout);
      return () => clearTimeout(timer);
    }
    return () => {};
  }, [localLoading, retryCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!formData.email || !formData.password) {
        throw new Error('Please fill in all required fields');
      }

      if (mode === 'register' && formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (mode === 'register') {
        const { validatePasswordStrength } = await import('@/lib/validation/password');
        const passwordValidation = validatePasswordStrength(formData.password);
        if (!passwordValidation.valid) {
          throw new Error(passwordValidation.errors[0] || 'Password does not meet requirements');
        }

        if (captchaEnabled && !captchaToken) {
          throw new Error('Please complete the CAPTCHA verification');
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
            throw new Error(captchaResult?.error?.message || 'CAPTCHA verification failed');
          }
        }
      }

      const result =
        mode === 'login'
          ? await signIn(formData.email, formData.password, rememberMe)
          : await signUp(formData.email, formData.password);

      if (result.error) {
        let errorMessage = apiErrorMessage(
          result.error,
          'Could not sign you in. Please try again.'
        );
        if (errorMessage.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (errorMessage.includes('Email not confirmed')) {
          errorMessage =
            'Please check your email and click the confirmation link before signing in.';
        } else if (errorMessage.includes('Too many requests')) {
          errorMessage = 'Too many login attempts. Please wait a few minutes before trying again.';
        } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
          errorMessage = 'Connection timeout. Please check your internet connection and try again.';
        }
        throw new Error(errorMessage);
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
      const errorMessage = apiErrorMessage(err, 'An unexpected error occurred');
      setError(errorMessage);
      setRetryCount(prev => prev + 1);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!formData.email) {
        throw new Error('Please enter your email address');
      }
      const result = await resetPassword({ email: formData.email });
      if (result.error) {
        throw new Error(apiErrorMessage(result.error, 'Failed to send reset email'));
      }
      setSuccess('Password reset email sent! Check your inbox and follow the instructions.');
    } catch (err) {
      const errorMessage = apiErrorMessage(err, 'Failed to send password reset email');
      setError(errorMessage);
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
    setSuccess(null);
    setRetryCount(0);
  };

  return {
    localLoading,
    error,
    success,
    retryCount,
    handleSubmit,
    handleForgotPassword,
    handleRetry,
    handleClearError,
  };
}

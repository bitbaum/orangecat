'use client';

import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import Button from '@/components/ui/Button';
import Loading from '@/components/Loading';
import { MFAVerify } from '@/components/auth/MFAVerify';
import { AuthHeroPanel } from './AuthHeroPanel';
import { AuthFormBody } from './AuthFormBody';
import { AuthSocialLogin } from './AuthSocialLogin';
import { useAuthForm } from './useAuthForm';
import { APP_NAME } from '@/config/brand';

/**
 * @param clientName  The app that sent the person here (Solon, Loki…), already
 *   resolved against oauth_clients by the server page — or null for a plain
 *   OrangeCat sign-in.
 */
export default function AuthPageClient({ clientName }: { clientName: string | null }) {
  const {
    mode,
    setMode,
    formData,
    setFormData,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    loading,
    error,
    success,
    rememberMe,
    setRememberMe,
    isPasswordFocused,
    setIsPasswordFocused,
    showMFAVerify,
    session,
    hydrated,
    captchaEnabled,
    turnstileSiteKey,
    handleCaptchaSuccess,
    handleCaptchaError,
    handleCaptchaExpire,
    handleSubmit,
    handleForgotPassword,
    handleRetry,
    handleClearError,
    handleMFAVerificationComplete,
    handleMFACancelled,
    handleOAuthSignIn,
    handleAnonymousSignIn,
  } = useAuthForm();

  if (session && hydrated) {
    return <Loading fullScreen message="Welcome back! Setting up your dashboard..." />;
  }

  if (showMFAVerify) {
    return (
      <div className="min-h-screen bg-surface-raised/40 dark:bg-surface-page flex items-center justify-center p-8">
        <MFAVerify
          onVerificationComplete={handleMFAVerificationComplete}
          onCancel={handleMFACancelled}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-raised/40 dark:bg-surface-page flex flex-col lg:flex-row">
      <AuthHeroPanel />

      <div className="flex-1 flex flex-col justify-center items-center p-8 max-[359px]:pt-4 lg:p-12 bg-surface-raised/40 dark:bg-surface-page">
        {/* Mobile-only back link — the desktop hero panel hosts the same
            link but is hidden below lg. Without this, mobile users have
            no non-browser escape from the form. */}
        <Link
          href={ROUTES.HOME}
          className="mb-6 inline-flex items-center gap-1.5 self-start text-sm text-fg-secondary transition-colors hover:text-fg-primary lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
        <div className="w-full max-w-md">
          {/* max-[359px] trims below: on the narrowest phones this form's last
              row (OAuth buttons) lands under the Loki feedback FAB
              (fixed bottom-right). Compacting non-essential vertical rhythm
              here — never touch-target sizes — clears it without a layout
              rewrite. */}
          <div className="text-center mb-8 max-[359px]:mb-4">
            <h2 className="text-2xl font-semibold mb-2 text-fg-primary">
              {mode === 'forgot'
                ? 'Reset password'
                : clientName
                  ? mode === 'login'
                    ? `Sign in to continue to ${clientName}`
                    : `Create your account for ${clientName}`
                  : mode === 'login'
                    ? 'Welcome back'
                    : 'Get started'}
            </h2>
            <p className="text-fg-secondary">
              {mode === 'forgot'
                ? 'Enter your email to receive reset instructions'
                : clientName
                  ? `One account for ${clientName}, ${APP_NAME} and the apps built with it.`
                  : mode === 'login'
                    ? `Sign in to your ${APP_NAME} account`
                    : `Create your ${APP_NAME} account`}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg oc-error-surface">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-status-negative mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-status-negative mb-3">{error}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetry}
                      disabled={loading}
                      className="text-status-negative/80 border-status-negative-subtle hover:bg-status-negative/10"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearError}
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

          {/* Anonymous-first: the fastest way in is the lead CTA. Pseudonymous
              by default is a core principle — let people start with zero friction
              and add an email later. Email/social remain right below. */}
          {/* Not when another app sent the person here: it needs an account
              it can attribute, and an anonymous one would only be asked for
              an email on the next screen. */}
          {mode !== 'forgot' && !clientName && (
            <div className="mb-6 max-[359px]:mb-3">
              <Button
                type="button"
                variant="accent"
                disabled={loading}
                onClick={handleAnonymousSignIn}
                className="w-full h-12 font-semibold"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Start instantly — no email
                  </span>
                )}
              </Button>
              <p className="mt-2 text-center text-xs text-fg-tertiary">
                Explore pseudonymously. Add an email anytime to secure your account.
              </p>
              <div className="relative mt-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-default" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-wider">
                  <span className="bg-surface-raised/40 dark:bg-surface-page px-3 text-fg-tertiary">
                    or {mode === 'login' ? 'sign in' : 'sign up'} with email
                  </span>
                </div>
              </div>
            </div>
          )}

          <AuthFormBody
            mode={mode}
            setMode={setMode}
            formData={formData}
            setFormData={setFormData}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            showConfirmPassword={showConfirmPassword}
            setShowConfirmPassword={setShowConfirmPassword}
            loading={loading}
            isPasswordFocused={isPasswordFocused}
            setIsPasswordFocused={setIsPasswordFocused}
            captchaEnabled={captchaEnabled}
            turnstileSiteKey={turnstileSiteKey}
            handleCaptchaSuccess={handleCaptchaSuccess}
            handleCaptchaError={handleCaptchaError}
            handleCaptchaExpire={handleCaptchaExpire}
            rememberMe={rememberMe}
            setRememberMe={setRememberMe}
            handleSubmit={handleSubmit}
            handleForgotPassword={handleForgotPassword}
          />

          <AuthSocialLogin
            mode={mode}
            setMode={setMode}
            loading={loading}
            onOAuthSignIn={handleOAuthSignIn}
          />
        </div>
      </div>
    </div>
  );
}

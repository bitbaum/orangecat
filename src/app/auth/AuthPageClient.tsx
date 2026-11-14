'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import Button from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import Loading from '@/components/Loading';
import { MFAVerify } from '@/components/auth/MFAVerify';
import { AuthHeroPanel } from './AuthHeroPanel';
import { AnonymousEntry, AuthNotices } from './AuthNotices';
import { AuthTitle } from './AuthTitle';
import { KeptSentence } from './KeptSentence';
import { AuthDivider } from './AuthDivider';
import { AuthFormBody } from './AuthFormBody';
import { AuthSocialLogin } from './AuthSocialLogin';
import { useAuthForm } from './useAuthForm';
import { EmailCodeSignIn } from './EmailCodeSignIn';
import { clearPendingEmailCode, readPendingEmailCode } from './pendingEmailCode';
import { PasskeySignInButton } from './PasskeySignInButton';
import { APP_NAME } from '@/config/brand';

const MODE_ITEMS = [
  { value: 'login', label: 'Sign in' },
  { value: 'register', label: 'Create account' },
] as const;

/**
 * @param clientName  The app that sent the person here (Solon, Loki…), already
 *   resolved against oauth_clients by the server page — or null for a plain
 *   OrangeCat sign-in.
 * @param emailCodeAvailable  Whether this deployment can mail a sign-in code;
 *   the option is not shown where it could never arrive.
 */
export default function AuthPageClient({
  clientName,
  clientHome = null,
  emailCodeAvailable,
  passkeysAvailable = false,
}: {
  clientName: string | null;
  /** Where "Back" leads when another app sent the person: that app, not OrangeCat's home. */
  clientHome?: string | null;
  emailCodeAvailable: boolean;
  /** Whether the auth server has passkeys switched on; the button is hidden otherwise. */
  passkeysAvailable?: boolean;
}) {
  const [codeMode, setCodeMode] = useState(false);
  // Back from the mail app after the browser discarded the tab: reopen the
  // code step that was waiting. In an effect, not initial state, so the first
  // client render still matches the server's.
  useEffect(() => {
    if (emailCodeAvailable && readPendingEmailCode()) {
      setCodeMode(true);
    }
  }, [emailCodeAvailable]);
  const {
    mode,
    switchMode,
    formData,
    setFormData,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    loading,
    anonLoading,
    fieldErrors,
    error,
    retryable,
    success,
    rememberMe,
    setRememberMe,
    showMFAVerify,
    setShowMFAVerify,
    handoff,
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
    // Not "Welcome back": this also shows to someone who signed up a second ago.
    return <Loading fullScreen message={`Opening ${APP_NAME}…`} />;
  }

  if (showMFAVerify) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center p-8">
        <MFAVerify
          onVerificationComplete={handleMFAVerificationComplete}
          onCancel={handleMFACancelled}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-page flex flex-col lg:flex-row">
      <AuthHeroPanel client={clientName ? { name: clientName, home: clientHome } : null} />

      <div className="flex-1 flex flex-col justify-center items-center p-8 max-[359px]:pt-4 lg:p-12 bg-surface-page">
        {/* Mobile-only back link — the desktop hero panel hosts the same
            link but is hidden below lg. Without this, mobile users have
            no non-browser escape from the form. */}
        <Link
          href={clientName && clientHome ? clientHome : ROUTES.HOME}
          className="mb-6 inline-flex items-center gap-1.5 self-start text-sm text-fg-secondary transition-colors hover:text-fg-primary lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
          {clientName && clientHome ? `Back to ${clientName}` : 'Back to home'}
        </Link>
        <div className="w-full max-w-md">
          {/* max-[359px] trims below: on the narrowest phones this form's last
              row (OAuth buttons) lands under the Loki feedback FAB
              (fixed bottom-right). Compacting non-essential vertical rhythm
              here — never touch-target sizes — clears it without a layout
              rewrite. */}
          <AuthTitle
            title={
              mode === 'forgot'
                ? 'Reset password'
                : clientName
                  ? mode === 'login'
                    ? `Sign in to continue to ${clientName}`
                    : `Create your account for ${clientName}`
                  : mode === 'login'
                    ? 'Welcome back'
                    : 'Get started'
            }
            lede={
              mode === 'forgot'
                ? 'Enter your email to receive reset instructions'
                : clientName
                  ? `One account for ${clientName}, ${APP_NAME} and the apps built with it.`
                  : mode === 'login'
                    ? `Sign in to your ${APP_NAME} account`
                    : `Create your ${APP_NAME} account`
            }
          />

          {mode !== 'forgot' && !clientName && <KeptSentence />}

          {/* Which side you are on, and the other one, before anything else:
              the switch used to be a text link under the provider buttons,
              below the fold on a phone. */}
          {mode !== 'forgot' && (
            <SegmentedControl
              label="Sign in or create an account"
              items={MODE_ITEMS}
              value={mode}
              onChange={next => {
                setCodeMode(false);
                switchMode(next);
              }}
              className="mb-6 max-[359px]:mb-3"
            />
          )}

          <AuthNotices
            error={error}
            success={success}
            retryable={retryable}
            loading={loading}
            onRetry={handleRetry}
            onDismiss={handleClearError}
          />

          {/* Creating an account: the fastest way in leads. Pseudonymous by
              default is a core principle — start with zero friction and add
              an email later. Not when another app sent the person here: it
              needs an account it can attribute. On the sign-in side the same
              way in sits at the foot, as a quiet option (AnonymousEntry), so
              the one orange button there is "Sign in" — the lead button no
              longer creates a new account for someone who came back. */}
          {mode === 'register' && !clientName && (
            <div className="mb-6 max-[359px]:mb-3">
              <AnonymousEntry
                variant="accent"
                label="Start instantly — no email"
                loading={anonLoading}
                disabled={loading || anonLoading}
                onClick={handleAnonymousSignIn}
              />
              <AuthDivider label="or sign up with email" className="mt-5" />
            </div>
          )}

          {codeMode && mode !== 'forgot' ? (
            <EmailCodeSignIn
              initialEmail={formData.email}
              clientId={handoff.client ?? null}
              captchaSiteKey={captchaEnabled ? turnstileSiteKey : undefined}
              onBack={() => {
                clearPendingEmailCode();
                setCodeMode(false);
              }}
              onNeedsSecondFactor={() => setShowMFAVerify(true)}
            />
          ) : (
            <>
              <AuthFormBody
                mode={mode}
                setMode={switchMode}
                formData={formData}
                setFormData={setFormData}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                showConfirmPassword={showConfirmPassword}
                setShowConfirmPassword={setShowConfirmPassword}
                loading={loading}
                busy={anonLoading}
                fieldErrors={fieldErrors}
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

              {/* The password-free way in: no password to invent, remember or reset. */}
              {emailCodeAvailable && mode !== 'forgot' && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || anonLoading}
                  onClick={() => setCodeMode(true)}
                  className="mt-3 h-12 w-full"
                >
                  {mode === 'login'
                    ? 'Email me a sign-in code instead'
                    : 'Sign up with an emailed code instead'}
                </Button>
              )}
              {passkeysAvailable && mode === 'login' && <PasskeySignInButton disabled={loading} />}
            </>
          )}

          <AuthSocialLogin
            mode={mode}
            setMode={switchMode}
            loading={loading || anonLoading}
            onOAuthSignIn={handleOAuthSignIn}
          />

          {mode === 'login' && !clientName && (
            <div className="mt-8 border-t border-default pt-6 max-[359px]:mt-4">
              <p className="mb-3 text-center text-sm text-fg-secondary">New here?</p>
              <AnonymousEntry
                variant="outline"
                label="Try it without an account"
                loading={anonLoading}
                disabled={loading || anonLoading}
                onClick={handleAnonymousSignIn}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

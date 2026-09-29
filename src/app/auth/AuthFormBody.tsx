'use client';

import Link from 'next/link';
import { ROUTES } from '@/config/routes';
import { ArrowRight, Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { TurnstileCaptcha } from '@/components/auth/TurnstileCaptcha';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import type { AuthMode, AuthFormData } from './useAuthForm';

interface AuthFormBodyProps {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  formData: AuthFormData;
  setFormData: (data: AuthFormData) => void;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (show: boolean) => void;
  loading: boolean;
  isPasswordFocused: boolean;
  setIsPasswordFocused: (focused: boolean) => void;
  captchaEnabled: boolean;
  turnstileSiteKey: string | undefined;
  handleCaptchaSuccess: (token: string) => void;
  handleCaptchaError: (err: string) => void;
  handleCaptchaExpire: () => void;
  rememberMe: boolean;
  setRememberMe: (remember: boolean) => void;
  handleSubmit: (e: React.FormEvent) => void;
  handleForgotPassword: (e: React.FormEvent) => void;
}

export function AuthFormBody({
  mode,
  setMode,
  formData,
  setFormData,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  loading,
  isPasswordFocused,
  setIsPasswordFocused,
  captchaEnabled,
  turnstileSiteKey,
  handleCaptchaSuccess,
  handleCaptchaError,
  handleCaptchaExpire,
  rememberMe,
  setRememberMe,
  handleSubmit,
  handleForgotPassword,
}: AuthFormBodyProps) {
  return (
    <form onSubmit={mode === 'forgot' ? handleForgotPassword : handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-fg-primary mb-2">
          Email address
        </label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={e => setFormData({ ...formData, email: e.target.value })}
          disabled={loading}
          placeholder="Enter your email"
          className="w-full h-12 px-4 rounded-lg border-strong focus:border-interactive focus:ring-ring bg-surface-base dark:text-fg-primary"
          autoComplete="email"
          required
        />
      </div>

      {mode !== 'forgot' && (
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-fg-primary mb-2">
            Password
          </label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => setIsPasswordFocused(false)}
              disabled={loading}
              placeholder="Enter your password"
              className="w-full h-12 px-4 pr-12 rounded-lg border-strong focus:border-interactive focus:ring-ring bg-surface-base dark:text-fg-primary"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-tertiary hover:text-fg-secondary dark:hover:text-fg-primary min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-surface-raised transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {mode === 'register' && (
            <PasswordStrengthIndicator
              password={formData.password}
              isFocused={isPasswordFocused}
              showOnlyWhenFocused={false}
            />
          )}
        </div>
      )}

      {mode === 'register' && (
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-fg-primary mb-2"
          >
            Confirm Password
          </label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
              disabled={loading}
              placeholder="Confirm your password"
              className="w-full h-12 px-4 pr-12 rounded-lg border-strong focus:border-interactive focus:ring-ring bg-surface-base dark:text-fg-primary"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-tertiary hover:text-fg-secondary dark:hover:text-fg-primary min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-surface-raised transition-colors"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}

      {mode === 'register' && captchaEnabled && turnstileSiteKey && (
        <div>
          <label className="block text-sm font-medium text-fg-primary mb-2">
            Verify you&apos;re human
          </label>
          <TurnstileCaptcha
            siteKey={turnstileSiteKey}
            onSuccess={handleCaptchaSuccess}
            onError={handleCaptchaError}
            onExpire={handleCaptchaExpire}
            theme="light"
          />
        </div>
      )}

      {mode === 'login' && (
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              disabled={loading}
              className="h-4 w-4 rounded border-strong text-fg-primary focus:ring-ring cursor-pointer"
            />
            <span className="text-sm text-fg-secondary">Remember me</span>
          </label>
          <button
            type="button"
            onClick={() => setMode('forgot')}
            className="text-sm text-fg-primary hover:text-fg-primary font-medium transition-colors"
          >
            Forgot password?
          </button>
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        variant="accent"
        className="w-full h-12 font-semibold"
      >
        {loading ? (
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>
              {mode === 'login'
                ? 'Signing in...'
                : mode === 'register'
                  ? 'Creating account...'
                  : 'Sending email...'}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center space-x-2">
            <span>
              {mode === 'login'
                ? 'Sign in'
                : mode === 'register'
                  ? 'Create account'
                  : 'Send reset email'}
            </span>
            {mode === 'forgot' ? <Mail className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
          </div>
        )}
      </Button>
      {mode === 'forgot' && (
        <p className="text-center text-sm">
          <Link
            href={ROUTES.AUTH_NO_EMAIL}
            className="text-fg-secondary underline hover:text-fg-primary"
          >
            Can&apos;t get to your email?
          </Link>
        </p>
      )}
    </form>
  );
}

'use client';

import { useId, useState } from 'react';
import { AlertCircle, Loader2, Key, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import supabase from '@/lib/supabase/browser';
import { COMPONENT_STYLES } from '@/config/design-system';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { passwordProblem } from '@bitbaum/accountkit/auth/password';
import { PasswordField } from '@bitbaum/accountkit/auth/password-field';

/**
 * accountkit's one new-password field (autocomplete, the show/hide eye inside
 * the box) dressed in this app's field styles, since its stylesheet is not
 * loaded here.
 */
const PASSWORD_FIELD_CLASSES = {
  inputWrap: 'relative',
  input: cn(COMPONENT_STYLES.field.control, 'block min-h-11 px-3 pr-12 text-base sm:text-sm'),
  reveal:
    'absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md text-fg-tertiary hover:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-fg-primary',
};

/** The set-a-new-password form, shown once a recovery session exists. */
export function NewPasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }
      const problem = passwordProblem(password);
      if (problem) {
        throw new Error(problem === 'empty' ? 'Enter a password.' : 'That password is too long.');
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        throw error;
      }
      onSuccess();
    } catch (err: unknown) {
      const caught = err as { message?: string };
      setError(caught.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-md w-full p-8 shadow-sm">
      <div className="text-center mb-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-surface-base border border-default mb-6">
          <Key className="h-8 w-8 text-fg-primary" />
        </div>
        <h1 className="text-2xl font-bold text-fg-primary mb-2">Create New Password</h1>
        <p className="text-fg-secondary">Enter a strong password to secure your account</p>
      </div>

      {error && (
        <div className="oc-error-surface mb-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 mt-0.5" />
            <div className="ml-3">
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor={`${fieldId}-new`} className={COMPONENT_STYLES.field.label}>
            New password
          </label>
          <PasswordField
            id={`${fieldId}-new`}
            value={password}
            onChange={setPassword}
            disabled={isLoading}
            classes={PASSWORD_FIELD_CLASSES}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor={`${fieldId}-confirm`} className={COMPONENT_STYLES.field.label}>
            Confirm new password
          </label>
          <PasswordField
            id={`${fieldId}-confirm`}
            value={confirmPassword}
            onChange={setConfirmPassword}
            disabled={isLoading}
            classes={PASSWORD_FIELD_CLASSES}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={isLoading || !password || !confirmPassword}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Updating Password...
            </>
          ) : (
            'Update Password'
          )}
        </Button>
      </form>

      <div className="mt-8 text-center">
        <Link
          href={`${ROUTES.AUTH}?mode=login`}
          className="inline-flex items-center text-sm text-fg-secondary hover:text-fg-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Login
        </Link>
      </div>
    </Card>
  );
}

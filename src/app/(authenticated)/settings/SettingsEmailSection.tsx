'use client';

import type { Ref } from 'react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Mail } from 'lucide-react';
import { NO_WAY_IN } from '@/lib/auth/sign-in-methods';

interface Props {
  email: string;
  /**
   * False for a "Start instantly" account: there is no address yet, and
   * adding one is what gives the account a way back in.
   */
  hasEmail?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  isSubmitting: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function SettingsEmailSection({
  email,
  hasEmail = true,
  inputRef,
  isSubmitting,
  onChange,
  onSubmit,
}: Props) {
  const [label, busyLabel] = hasEmail
    ? ['Update Email', 'Updating...']
    : [NO_WAY_IN.addEmail, 'Adding…'];
  return (
    <div>
      <h3 className="text-lg font-semibold text-fg-primary mb-4">Email Address</h3>
      <p className="text-fg-secondary mb-6">
        {hasEmail ? (
          <>
            This is the email address associated with your account. You&apos;ll receive important
            notifications here.
          </>
        ) : (
          <>
            Add an email to keep this account. Until you do, it lives only in this browser and there
            is no way to sign in to it again once you sign out.
          </>
        )}
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          ref={inputRef}
          label="Email"
          name="email"
          type="email"
          value={email}
          onChange={onChange}
          icon={Mail}
          className="max-w-md"
        />
        {hasEmail && (
          <div className="max-w-md rounded-md border border-subtle bg-surface-raised/30 p-4">
            <p className="text-base text-fg-secondary">
              <strong>Note:</strong> When you update your email, we&apos;ll send a confirmation link
              to your new address.
            </p>
          </div>
        )}
        <div className="flex justify-start">
          <Button
            type="submit"
            variant={hasEmail ? 'outline' : 'primary'}
            disabled={isSubmitting}
            className="px-6 py-2"
          >
            {isSubmitting ? busyLabel : label}
          </Button>
        </div>
      </form>
    </div>
  );
}

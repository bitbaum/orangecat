'use client';

import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Mail } from 'lucide-react';

interface Props {
  email: string;
  /** The account has no email yet (anonymous): offer to add one, not to change it. */
  noEmail?: boolean;
  isSubmitting: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function SettingsEmailSection({
  email,
  noEmail = false,
  isSubmitting,
  onChange,
  onSubmit,
}: Props) {
  return (
    <div>
      <h3 className="mb-2 text-lg font-semibold text-fg-primary">
        {noEmail ? 'Add an email' : 'Email address'}
      </h3>
      <p className="mb-4 max-w-prose text-fg-secondary">
        {noEmail
          ? 'This account has no email yet, so it only exists in this browser. Add one and you can sign in anywhere.'
          : 'You sign in with this address, and important notifications go here. Changing it sends a confirmation link to the new address.'}
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Email"
          name="email"
          type="email"
          value={email}
          onChange={onChange}
          icon={Mail}
          className="max-w-md"
        />
        <Button
          type="submit"
          variant={noEmail ? 'primary' : 'outline'}
          disabled={isSubmitting}
          className="min-h-11"
        >
          {isSubmitting ? 'Saving…' : noEmail ? 'Add email' : 'Update email'}
        </Button>
      </form>
    </div>
  );
}

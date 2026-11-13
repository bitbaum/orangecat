'use client';

import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Eye, EyeOff, Lock } from 'lucide-react';

interface Props {
  newPassword: string;
  confirmPassword: string;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  isSubmitting: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function SettingsPasswordSection({
  newPassword,
  confirmPassword,
  showPassword,
  setShowPassword,
  isSubmitting,
  onChange,
  onSubmit,
}: Props) {
  return (
    <div>
      <h3 className="mb-2 text-lg font-semibold text-fg-primary">Change password</h3>
      <p className="mb-4 max-w-prose text-fg-secondary">
        Choose a strong password to keep your account secure.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="max-w-md space-y-4">
          <Input
            label="New Password"
            name="newPassword"
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={onChange}
            placeholder="Enter new password (min. 6 characters)"
            icon={Lock}
          />
          <Input
            label="Confirm Password"
            name="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={onChange}
            placeholder="Confirm new password"
            icon={Lock}
          />
        </div>
        <div className="flex items-center justify-between max-w-md">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowPassword(!showPassword)}
            className="min-h-11 px-0 text-sm"
          >
            {showPassword ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {showPassword ? 'Hide' : 'Show'} passwords
          </Button>
          <Button type="submit" variant="outline" disabled={isSubmitting} className="min-h-11">
            {isSubmitting ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </form>
    </div>
  );
}

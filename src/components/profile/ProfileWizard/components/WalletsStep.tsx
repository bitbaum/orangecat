/**
 * WALLETS STEP COMPONENT
 * Bitcoin and Lightning wallet fields
 */

import { UseFormReturn } from 'react-hook-form';
import { Wallet } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { ProfileFormValues } from '../types';

interface WalletsStepProps {
  form: UseFormReturn<ProfileFormValues>;
}

export function WalletsStep({ form }: WalletsStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-fg-primary mb-2">Bitcoin Wallets</h2>
        <p className="text-fg-secondary mb-3">
          Set up addresses where people can send you funding.
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-bitcoinOrange/10 text-bitcoin-text border border-bitcoinOrange/20 text-xs rounded-full">
          <span>₿</span>
          <span>All wallet fields are optional</span>
        </div>
      </div>

      <FormField
        control={form.control}
        name="bitcoin_address"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium text-fg-primary">Bitcoin Address</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value || ''}
                placeholder="Enter your Bitcoin address (starts with bc1, 1, or 3)"
                className="text-sm font-mono"
              />
            </FormControl>
            <FormDescription className="text-xs text-fg-secondary">
              Optional: Your Bitcoin address for receiving funding
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="lightning_address"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium text-fg-primary">Lightning Address</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value || ''}
                placeholder="yourname@lightning.provider.com"
                className="text-sm"
              />
            </FormControl>
            <FormDescription className="text-xs text-fg-secondary">
              Optional: Lightning address for instant, low-fee payments
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="mt-8 bg-surface-raised rounded-lg p-6 border border-default">
        <div className="text-center text-fg-secondary py-8">
          <Wallet className="w-16 h-16 mx-auto mb-4 text-fg-tertiary" />
          <h3 className="text-lg font-medium text-fg-primary mb-2">Manage Wallets Later</h3>
          <p className="text-sm mb-4">
            You can add and manage multiple Bitcoin wallets from your profile page or dashboard
            after completing setup.
          </p>
          <p className="text-xs text-fg-secondary">
            Go to Profile → Wallets tab or Dashboard → My Wallets
          </p>
        </div>
      </div>
    </div>
  );
}

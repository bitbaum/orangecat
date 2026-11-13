/**
 * Contact Section
 *
 * Form section for contact information (email, phone).
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 */

'use client';

import { Mail } from 'lucide-react';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/Input';
import { ProfileFieldType } from '@/lib/profile-guidance';
import { Control } from 'react-hook-form';
import { ProfileFormValues } from '../types';
import { PROFILE_SECTIONS, PROFILE_SECTION_DESCRIPTIONS } from '../constants';

interface ContactSectionProps {
  control: Control<ProfileFormValues>;
  onFieldFocus?: (field: ProfileFieldType) => void;
  userEmail?: string;
}

export function ContactSection({ control, onFieldFocus, userEmail }: ContactSectionProps) {
  return (
    <div className="oc-surface space-y-4 px-4 py-5 sm:px-5 sm:py-6">
      <div className="mb-1">
        <h3 className="text-sm font-semibold text-fg-primary uppercase tracking-wide">
          {PROFILE_SECTIONS.CONTACT}
        </h3>
        <p className="mt-1 text-xs text-fg-secondary">{PROFILE_SECTION_DESCRIPTIONS.CONTACT}</p>
      </div>

      {/* Contact Email */}
      <FormField
        control={control}
        name="contact_email"
        render={({ field }) => (
          <FormItem id="contactEmail">
            <FormLabel className="text-sm font-medium text-fg-primary">
              Contact Email (public)
            </FormLabel>
            <FormControl>
              <Input
                type="email"
                placeholder="contact@example.com"
                {...field}
                value={field.value || ''}
                onFocus={() => onFieldFocus?.('contactEmail')}
              />
            </FormControl>
            <FormDescription className="text-xs text-fg-secondary">
              Visible on your public profile. Leave it empty to show none; your sign-in email is
              never shown.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Registration Email (read-only) */}
      {userEmail && (
        <div className="p-3 bg-surface-raised rounded-lg border border-subtle">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-4 h-4 text-fg-tertiary" />
            <span className="text-xs font-medium text-fg-secondary">
              Registration Email (private)
            </span>
          </div>
          <p className="text-sm text-fg-primary">{userEmail}</p>
          <p className="text-xs text-fg-secondary mt-1">Used for account login only</p>
        </div>
      )}

      {/* Phone */}
      <FormField
        control={control}
        name="phone"
        render={({ field }) => (
          <FormItem id="phone">
            <FormLabel className="text-sm font-medium text-fg-primary">Phone (optional)</FormLabel>
            <FormControl>
              <Input
                type="tel"
                placeholder="+41 XX XXX XX XX"
                {...field}
                value={field.value || ''}
                onFocus={() => onFieldFocus?.('phone')}
              />
            </FormControl>
            <FormDescription className="text-xs text-fg-secondary">
              Helps supporters contact you
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

/**
 * Profile Basic Section
 *
 * Form section for basic profile information (username, name, bio, location).
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 */

'use client';

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { ProfileFieldType } from '@/lib/profile-guidance';
import { LocationMode } from '@/lib/location-privacy';
import { Control, UseFormSetValue, UseFormRegister } from 'react-hook-form';
import type { ProfileFormValues } from '../types';
import { ProfileLocationSection } from './ProfileLocationSection';
import { PROFILE_SECTIONS, PROFILE_SECTION_DESCRIPTIONS } from '../constants';

interface ProfileBasicSectionProps {
  control: Control<ProfileFormValues>;
  onFieldFocus?: (field: ProfileFieldType) => void;
  locationMode: LocationMode;
  setLocationMode: (mode: LocationMode) => void;
  locationGroupLabel: string;
  setLocationGroupLabel: (value: string) => void;
  form: {
    control: Control<ProfileFormValues>;
    setValue: UseFormSetValue<ProfileFormValues>;
    register: UseFormRegister<ProfileFormValues>;
  };
}

export function ProfileBasicSection({
  control,
  onFieldFocus,
  locationMode,
  setLocationMode,
  locationGroupLabel,
  setLocationGroupLabel,
  form,
}: ProfileBasicSectionProps) {
  return (
    <div className="oc-surface space-y-4 px-4 py-5 sm:px-5 sm:py-6">
      <div className="mb-1">
        <h3 className="text-sm font-semibold text-fg-primary uppercase tracking-wide">
          {PROFILE_SECTIONS.PROFILE}
        </h3>
        <p className="mt-1 text-xs text-fg-secondary">{PROFILE_SECTION_DESCRIPTIONS.PROFILE}</p>
      </div>

      {/* Username - Required field */}
      <FormField
        control={control}
        name="username"
        render={({ field }) => {
          const { value, ...rest } = field;
          return (
            <FormItem>
              <FormLabel className="text-sm font-medium text-fg-primary">
                Username <span className="text-status-negative">*</span>
              </FormLabel>
              {/* FormControl gives its child the id the label points at, so it
                  wraps the Input, not the "@" wrapper. */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-fg-secondary font-medium z-10 pointer-events-none">
                  @
                </span>
                <FormControl>
                  <Input
                    placeholder="your_unique_username"
                    className="pl-8"
                    {...rest}
                    value={value || ''}
                    onFocus={() => onFieldFocus?.('username')}
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          );
        }}
      />

      {/* Name - Display name */}
      <FormField
        control={control}
        name="name"
        render={({ field }) => (
          <FormItem id="name">
            <FormLabel className="text-sm font-medium text-fg-primary">Name</FormLabel>
            <FormControl>
              <Input
                placeholder="Your display name"
                {...field}
                value={field.value || ''}
                onFocus={() => onFieldFocus?.('name')}
              />
            </FormControl>
            <FormDescription className="text-xs text-fg-secondary">
              This is how others will see you
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Bio */}
      <FormField
        control={control}
        name="bio"
        render={({ field }) => (
          <FormItem id="bio">
            <FormLabel className="text-sm font-medium text-fg-primary">Bio</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Tell your story..."
                // Auto-grow with the content (no inner scrollbar) where supported,
                // capped so a very long bio doesn't run away; still hand-resizable
                // as a fallback for browsers without field-sizing.
                className="min-h-20 max-h-[60vh] resize-y [field-sizing:content]"
                {...field}
                value={field.value || ''}
                onFocus={() => onFieldFocus?.('bio')}
              />
            </FormControl>
            <FormDescription className="text-xs text-fg-secondary">
              Share your story with the community
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Location Section */}
      <ProfileLocationSection
        form={form}
        onFieldFocus={onFieldFocus}
        locationMode={locationMode}
        setLocationMode={setLocationMode}
        locationGroupLabel={locationGroupLabel}
        setLocationGroupLabel={setLocationGroupLabel}
      />
    </div>
  );
}

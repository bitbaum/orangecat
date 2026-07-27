/**
 * Profile Status Section
 *
 * Lets a maker express the current status of their work and concrete ways
 * others can help — the two things a bio alone doesn't capture. Options are
 * config-driven (@/config/maker-status), never hardcoded here.
 *
 * Created: 2026-07-27
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Control } from 'react-hook-form';
import type { ProfileFormValues } from '../types';
import { PROFILE_SECTIONS, PROFILE_SECTION_DESCRIPTIONS } from '../constants';
import {
  makerStatusSelectOptions,
  helpWantedSelectOptions,
  MAX_HELP_WANTED_SELECTIONS,
  type HelpWantedOption,
} from '@/config/maker-status';
import { cn } from '@/lib/utils';

interface ProfileStatusSectionProps {
  control: Control<ProfileFormValues>;
}

export function ProfileStatusSection({ control }: ProfileStatusSectionProps) {
  return (
    <div className="oc-surface space-y-4 px-4 py-5 sm:px-5 sm:py-6">
      <div className="mb-1">
        <h3 className="text-sm font-semibold text-fg-primary uppercase tracking-wide">
          {PROFILE_SECTIONS.STATUS}
        </h3>
        <p className="mt-1 text-xs text-fg-secondary">{PROFILE_SECTION_DESCRIPTIONS.STATUS}</p>
      </div>

      <FormField
        control={control}
        name="current_status"
        render={({ field }) => (
          <FormItem id="currentStatus">
            <FormLabel className="text-sm font-medium text-fg-primary">Current status</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || ''}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="What stage is your work at?" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {makerStatusSelectOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription className="text-xs text-fg-secondary">
              Shown on your public profile so visitors know where things stand.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="help_wanted"
        render={({ field }) => {
          const selected: HelpWantedOption[] = field.value || [];
          const toggle = (value: HelpWantedOption) => {
            if (selected.includes(value)) {
              field.onChange(selected.filter(v => v !== value));
              return;
            }
            if (selected.length >= MAX_HELP_WANTED_SELECTIONS) {
              return;
            }
            field.onChange([...selected, value]);
          };
          return (
            <FormItem id="helpWanted">
              <FormLabel className="text-sm font-medium text-fg-primary">
                How can others help?
              </FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-2">
                  {helpWantedSelectOptions.map(option => {
                    const isSelected = selected.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggle(option.value)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                          isSelected
                            ? 'border-transparent bg-fg-primary text-fg-inverted'
                            : 'border-default text-fg-secondary hover:bg-surface-raised'
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </FormControl>
              <FormDescription className="text-xs text-fg-secondary">
                Pick up to {MAX_HELP_WANTED_SELECTIONS} — shown as tags on your public profile.
              </FormDescription>
              <FormMessage />
            </FormItem>
          );
        }}
      />
    </div>
  );
}

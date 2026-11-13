/**
 * Privacy Section
 *
 * Owner control for per-field visibility: which optional public profile fields
 * are hidden from visitors. Persists into the profiles.privacy_settings jsonb
 * column via the form's `privacy_settings` value. See config/profile-privacy.ts
 * (SSOT for the hideable-field list) and the server-side redaction in the public
 * profile page + /api/profiles lookup.
 */

'use client';

import { EyeOff } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import { SettingToggleRow } from '@/components/ui/SettingToggleRow';
import {
  HIDEABLE_PROFILE_FIELDS,
  getHiddenProfileFields,
  buildPrivacySettings,
  type HideableProfileField,
} from '@/config/profile-privacy';
import { PROFILE_SECTIONS, PROFILE_SECTION_DESCRIPTIONS } from '../constants';
import type { ProfileFormValues } from '../types';

interface PrivacySectionProps {
  form: UseFormReturn<ProfileFormValues>;
}

export function PrivacySection({ form }: PrivacySectionProps) {
  const privacySettings = form.watch('privacy_settings');
  const hidden = new Set(getHiddenProfileFields(privacySettings));

  const toggle = (key: HideableProfileField) => {
    const next = new Set(hidden);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    form.setValue('privacy_settings', buildPrivacySettings(privacySettings, [...next]), {
      shouldDirty: true,
    });
  };

  return (
    <div className="oc-surface space-y-4 px-4 py-5 sm:px-5 sm:py-6">
      <div className="mb-1">
        <h3 className="text-sm font-semibold text-fg-primary uppercase tracking-wide">
          {PROFILE_SECTIONS.PRIVACY}
        </h3>
        <p className="mt-1 text-xs text-fg-secondary">{PROFILE_SECTION_DESCRIPTIONS.PRIVACY}</p>
      </div>

      <ul className="divide-y divide-subtle">
        {HIDEABLE_PROFILE_FIELDS.map(({ key, label }) => {
          const isHidden = hidden.has(key);
          return (
            <li key={key}>
              <SettingToggleRow
                leading={
                  <EyeOff
                    className={`mt-0.5 h-4 w-4 ${isHidden ? 'text-fg-primary' : 'text-fg-tertiary'}`}
                    aria-hidden
                  />
                }
                // The words are the action, so "on" reads as "hidden".
                label={`Hide ${label.toLowerCase()}`}
                checked={isHidden}
                onCheckedChange={() => toggle(key)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

'use client';

import { CheckCircle2 } from 'lucide-react';
import { GRADIENTS } from '@/config/gradients';
import { DynamicSidebar } from '@/components/create/DynamicSidebar';
import {
  profileGuidanceContent,
  profileDefaultContent,
  type ProfileFieldType,
} from '@/lib/profile-guidance';
import { Card } from '@/components/ui/Card';
import type { Profile } from '@/types/profile';
import { getProfileMissingFields } from './profile-completion';

interface ProfileSidebarPanelProps {
  profile: Profile;
  completionPercentage: number;
  focusedField: ProfileFieldType;
}

export function ProfileSidebarPanel({
  profile,
  completionPercentage,
  focusedField,
}: ProfileSidebarPanelProps) {
  const missingFields = getProfileMissingFields(profile);

  return (
    <div className="lg:sticky lg:top-20 space-y-6">
      <Card className="p-6 shadow-sm border-default">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-fg-primary">Profile Completion</h3>
            <span className="text-sm font-semibold text-fg-primary bg-surface-raised dark:text-fg-primary dark:bg-surface-raised px-2.5 py-1 rounded-full">
              {completionPercentage}%
            </span>
          </div>
          <div className="w-full bg-surface-raised rounded-full h-3 overflow-hidden">
            <div
              className={`${GRADIENTS.progressBitcoin} h-3 rounded-full transition-all duration-700 ease-out shadow-sm`}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
        {completionPercentage < 100 && (
          <div className="mt-3 text-base text-fg-primary">
            <div className="font-medium mb-1">To reach 100%, add:</div>
            <ul className="list-disc list-inside space-y-0.5">
              {missingFields.map(field => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>
        )}
        {completionPercentage === 100 && (
          <div className="flex items-center gap-2 text-sm text-status-positive bg-status-positive-subtle px-3 py-2 rounded-lg border border-subtle mt-4">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">Profile complete!</span>
          </div>
        )}
      </Card>

      <DynamicSidebar<NonNullable<ProfileFieldType>>
        activeField={focusedField}
        guidanceContent={profileGuidanceContent}
        defaultContent={profileDefaultContent}
      />
    </div>
  );
}

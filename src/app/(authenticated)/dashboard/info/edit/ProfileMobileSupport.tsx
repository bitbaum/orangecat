'use client';

import { CheckCircle2 } from 'lucide-react';
import { FieldHelpButton } from '@/components/ui/FieldHelpButton';
import { GRADIENTS } from '@/config/gradients';
import { DynamicSidebar } from '@/components/create/DynamicSidebar';
import {
  profileGuidanceContent,
  profileDefaultContent,
  type ProfileFieldType,
} from '@/lib/profile-guidance';

interface ProfileMobileSupportProps {
  completionPercentage: number;
  missingFields: string[];
  focusedField: ProfileFieldType;
  showMobileGuidance: boolean;
  setShowMobileGuidance: (show: boolean) => void;
}

export function ProfileMobileSupport({
  completionPercentage,
  missingFields,
  focusedField,
  showMobileGuidance,
  setShowMobileGuidance,
}: ProfileMobileSupportProps) {
  return (
    <>
      {/* Progress bar at top (mobile only) */}
      <div className="lg:hidden mb-6">
        <div className="bg-surface-base rounded-lg border border-default shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-fg-primary">Profile Completion</span>
            <span className="text-sm font-bold text-fg-primary">{completionPercentage}%</span>
          </div>
          <div className="w-full bg-surface-raised rounded-full h-2 overflow-hidden">
            <div
              className={`${GRADIENTS.progressBitcoin} h-2 rounded-full transition-all duration-700 ease-out`}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          {completionPercentage === 100 ? (
            <div className="flex items-center gap-2 text-xs text-status-positive mt-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">Profile complete!</span>
            </div>
          ) : (
            <div className="mt-3 text-xs text-fg-primary">
              <div className="font-medium mb-1">To reach 100%, add:</div>
              <ul className="list-disc list-inside space-y-0.5">
                {missingFields.map(field => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Floating help button (mobile, only when a field is focused) */}
      {focusedField && <FieldHelpButton onClick={() => setShowMobileGuidance(true)} />}

      {/* Guidance modal (mobile) */}
      {showMobileGuidance && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end"
          onClick={() => setShowMobileGuidance(false)}
        >
          <div
            className="w-full bg-surface-base rounded-t-lg shadow-sm max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-surface-base border-b border-default px-4 py-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-fg-primary">Help & Guidance</h3>
              <button
                onClick={() => setShowMobileGuidance(false)}
                aria-label="Close help"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 transition-colors hover:bg-surface-raised"
              >
                <svg
                  className="w-5 h-5 text-fg-secondary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <DynamicSidebar<NonNullable<ProfileFieldType>>
                activeField={focusedField}
                guidanceContent={profileGuidanceContent}
                defaultContent={profileDefaultContent}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

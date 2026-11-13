'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { FieldHelpButton } from '@/components/ui/FieldHelpButton';
import { DynamicSidebar } from '@/components/create/DynamicSidebar';
import {
  profileGuidanceContent,
  profileDefaultContent,
  type ProfileFieldType,
} from '@/lib/profile-guidance';

interface ProfileMobileSupportProps {
  focusedField: ProfileFieldType;
  showMobileGuidance: boolean;
  setShowMobileGuidance: (show: boolean) => void;
}

export function ProfileMobileSupport({
  focusedField,
  showMobileGuidance,
  setShowMobileGuidance,
}: ProfileMobileSupportProps) {
  return (
    <>
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

/**
 * Profile completion on a phone: below the form, closed until wanted.
 *
 * It used to sit above the page header and print the whole missing list, so a
 * phone opened on a checklist with no field in sight.
 */
export function ProfileMobileCompletion({
  completionPercentage,
  missingFields,
}: {
  completionPercentage: number;
  missingFields: string[];
}) {
  const [open, setOpen] = useState(false);

  if (completionPercentage >= 100) {
    return (
      <p className="mb-0 flex items-center gap-2 text-sm text-status-positive lg:hidden">
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
        Profile complete
      </p>
    );
  }

  return (
    <div className="oc-surface px-4 py-3 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-controls="profile-completion-missing"
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm font-medium text-fg-primary"
      >
        <span>Profile {completionPercentage}% complete — see what is missing</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
        <div
          className="h-2 rounded-full bg-fg-primary transition-all duration-700 ease-out"
          style={{ width: `${completionPercentage}%` }}
        />
      </div>
      {open && (
        <ul
          id="profile-completion-missing"
          className="mb-0 mt-3 list-inside list-disc space-y-0.5 text-sm text-fg-secondary"
        >
          {missingFields.map(field => (
            <li key={field}>{field}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

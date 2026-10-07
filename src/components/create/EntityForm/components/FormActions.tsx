/**
 * FORM ACTIONS COMPONENT
 * Submit/cancel buttons with wizard mode support
 */

import { Save } from 'lucide-react';
import Button from '@/components/ui/Button';

interface WizardMode {
  currentStep: number;
  totalSteps: number;
  visibleFields: string[];
  onNext?: () => void;
  onPrevious?: () => void;
  onSkip?: () => void;
  isLastStep?: boolean;
}

interface FormActionsProps {
  isSubmitting: boolean;
  mode: 'create' | 'edit';
  entityName: string;
  backUrl: string;
  wizardMode?: WizardMode;
  lastSavedAt?: Date | null;
  formatRelativeTime?: (timestamp: string) => string;
}

export function FormActions({
  isSubmitting,
  mode,
  entityName,
  backUrl,
  wizardMode,
  lastSavedAt,
  formatRelativeTime,
}: FormActionsProps) {
  return (
    <div className="pt-6 border-t space-y-3">
      {/* Draft save indicator */}
      {mode === 'create' && lastSavedAt && !wizardMode && formatRelativeTime && (
        <div className="flex items-center gap-2 text-sm text-fg-secondary">
          <Save className="h-4 w-4" />
          <span>Draft saved {formatRelativeTime(lastSavedAt.toISOString())}</span>
        </div>
      )}

      {wizardMode ? (
        <WizardNavigation
          wizardMode={wizardMode}
          isSubmitting={isSubmitting}
          entityName={entityName}
        />
      ) : (
        <StandardActions
          isSubmitting={isSubmitting}
          mode={mode}
          entityName={entityName}
          backUrl={backUrl}
        />
      )}
    </div>
  );
}

function WizardNavigation({
  wizardMode,
  isSubmitting,
  entityName,
}: {
  wizardMode: WizardMode;
  isSubmitting: boolean;
  entityName: string;
}) {
  return (
    <div className="flex justify-between">
      {wizardMode.onPrevious && (
        <Button
          type="button"
          variant="outline"
          onClick={wizardMode.onPrevious}
          disabled={isSubmitting}
        >
          Previous
        </Button>
      )}
      <div className="flex gap-3 ml-auto">
        {wizardMode.onSkip && (
          <Button type="button" variant="ghost" onClick={wizardMode.onSkip} disabled={isSubmitting}>
            Skip
          </Button>
        )}
        {wizardMode.onNext ? (
          <Button type="submit" disabled={isSubmitting}>
            Next
          </Button>
        ) : wizardMode.isLastStep ? (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : `Create ${entityName}`}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function StandardActions({
  isSubmitting,
  mode,
  entityName,
  backUrl,
}: {
  isSubmitting: boolean;
  mode: 'create' | 'edit';
  entityName: string;
  backUrl: string;
}) {
  return (
    <div className="flex gap-4">
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? `${mode === 'create' ? 'Creating' : 'Saving'}...`
          : `${mode === 'create' ? 'Create' : 'Save'} ${entityName}`}
      </Button>
      {/* Button renders the link itself — a <button> inside an <a> is
          invalid HTML and two tab stops for one control. */}
      <Button href={backUrl} variant="outline" disabled={isSubmitting}>
        Cancel
      </Button>
    </div>
  );
}

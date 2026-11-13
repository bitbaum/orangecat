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

/**
 * Both action rows are a two-column grid of full-width, 44px buttons, so the
 * committing pair is equal: they used to be content-width, 40px tall, and
 * "Create" sat beside a "Cancel" of a different size.
 */
const ACTION_GRID = 'grid grid-cols-2 gap-3';
const ACTION_BUTTON = 'min-h-11 w-full';

function WizardNavigation({
  wizardMode,
  isSubmitting,
  entityName,
}: {
  wizardMode: WizardMode;
  isSubmitting: boolean;
  entityName: string;
}) {
  const forward = wizardMode.onNext ? (
    <Button type="submit" disabled={isSubmitting} className={ACTION_BUTTON}>
      Next
    </Button>
  ) : wizardMode.isLastStep ? (
    <Button type="submit" disabled={isSubmitting} className={ACTION_BUTTON}>
      {isSubmitting ? 'Creating...' : `Create ${entityName}`}
    </Button>
  ) : null;

  return (
    <div className={ACTION_GRID}>
      {wizardMode.onPrevious ? (
        <Button
          type="button"
          variant="outline"
          onClick={wizardMode.onPrevious}
          disabled={isSubmitting}
          className={ACTION_BUTTON}
        >
          Previous
        </Button>
      ) : (
        <span aria-hidden />
      )}
      {forward}
      {wizardMode.onSkip && (
        <Button
          type="button"
          variant="ghost"
          onClick={wizardMode.onSkip}
          disabled={isSubmitting}
          className={`${ACTION_BUTTON} col-span-2`}
        >
          Skip this step
        </Button>
      )}
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
    <div className={ACTION_GRID}>
      <Button type="submit" disabled={isSubmitting} className={ACTION_BUTTON}>
        {isSubmitting
          ? `${mode === 'create' ? 'Creating' : 'Saving'}...`
          : `${mode === 'create' ? 'Create' : 'Save'} ${entityName}`}
      </Button>
      {/* Button renders the link itself — a <button> inside an <a> is
          invalid HTML and two tab stops for one control. */}
      <Button href={backUrl} variant="outline" disabled={isSubmitting} className={ACTION_BUTTON}>
        Cancel
      </Button>
    </div>
  );
}

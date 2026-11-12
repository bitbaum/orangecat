/**
 * Form Error Display
 *
 * Component to display form validation errors in a user-friendly way.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 */

'use client';

interface FormErrorDisplayProps {
  errors: Record<string, { message?: string }>;
}

export function FormErrorDisplay({ errors }: FormErrorDisplayProps) {
  if (Object.keys(errors).length === 0) {
    return null;
  }

  return (
    <div className="oc-error-surface">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-status-negative text-xs font-bold text-fg-inverted">
          !
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold mb-2">Please fix the following errors:</h4>
          <ul className="text-sm text-status-negative space-y-1 list-disc list-inside">
            {Object.entries(errors).map(([field, error]) => (
              <li key={field}>
                <span className="font-medium">{field}:</span>{' '}
                {error?.message?.toString() || 'Invalid value'}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

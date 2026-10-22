import { TextareaHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';
import { COMPONENT_STYLES } from '@/config/design-system';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, description, error, required, id, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id || generatedId;
    const errorId = `${textareaId}-error`;
    const descriptionId = `${textareaId}-description`;

    return (
      <div className="space-y-2">
        {label && (
          <label htmlFor={textareaId} className={COMPONENT_STYLES.field.label}>
            {label}
            {required && <span className={COMPONENT_STYLES.field.required}>*</span>}
          </label>
        )}
        <textarea
          id={textareaId}
          className={cn(
            COMPONENT_STYLES.field.control,
            'flex min-h-20 px-3 py-2 text-base sm:text-sm',
            error && COMPONENT_STYLES.field.errorControl,
            className
          )}
          aria-describedby={cn(error && errorId, description && descriptionId)}
          aria-invalid={error ? 'true' : 'false'}
          required={required}
          ref={ref}
          {...props}
        />
        {description && !error && (
          <p id={descriptionId} className={COMPONENT_STYLES.field.description}>
            {description}
          </p>
        )}
        {error && (
          <p id={errorId} className={COMPONENT_STYLES.field.errorText} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
export default Textarea;

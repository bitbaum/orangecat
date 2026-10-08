import { ComponentProps, InputHTMLAttributes, forwardRef, useId } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COMPONENT_STYLES } from '@/config/design-system';
import { DateInput } from '@bitbaum/whenkit/react';
import '@bitbaum/whenkit/styles.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  icon?: LucideIcon;
}

// Helper function to get icon test ID based on icon name
const getIconTestId = (Icon: LucideIcon): string => {
  const iconName = Icon.displayName || Icon.name || 'icon';
  // Map common Lucide icon names to test IDs
  const iconMap: Record<string, string> = {
    Mail: 'mail',
    Lock: 'lock',
    Bitcoin: 'bitcoin',
    User: 'user',
    Search: 'search',
    Key: 'key',
    Eye: 'eye',
    EyeOff: 'eye-off',
  };
  return iconMap[iconName] || iconName.toLowerCase();
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, description, error, required, icon: Icon, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const descriptionId = `${inputId}-description`;
    const controlClass = cn(
      COMPONENT_STYLES.field.control,
      'block h-10 px-3 text-sm',
      error && COMPONENT_STYLES.field.errorControl,
      Icon && 'pl-10',
      className
    );
    const controlProps = {
      id: inputId,
      required,
      'aria-describedby': cn(error && errorId, description && descriptionId),
      'aria-invalid': error ? ('true' as const) : ('false' as const),
    };
    // A date is picked, not typed: the value reads in words ("Sat, 11 Oct 2026
    // · 14:00") in this same control styling, and the platform picker still
    // opens on tap (@bitbaum/whenkit). Every date field in the app comes
    // through here — the entity forms, group events, proposals — so one
    // branch replaces the browser's bare "tt.mm.jjjj" field everywhere.
    const isDate = props.type === 'date' || props.type === 'datetime-local';

    return (
      <div className="space-y-2">
        {label && (
          <label htmlFor={inputId} className={COMPONENT_STYLES.field.label}>
            {label}
            {required && <span className={COMPONENT_STYLES.field.required}>*</span>}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Icon
                className="h-5 w-5 text-muted-dim"
                data-testid={`icon-${getIconTestId(Icon)}`}
              />
            </div>
          )}
          {isDate ? (
            <DateInput
              {...controlProps}
              {...(props as ComponentProps<typeof DateInput>)}
              type={props.type as 'date' | 'datetime-local'}
              className={controlClass}
              ref={ref}
            />
          ) : (
            <input {...controlProps} className={controlClass} ref={ref} {...props} />
          )}
        </div>
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

Input.displayName = 'Input';

export { Input };
export default Input;

import type { ReactNode } from 'react';

import Button from '@/components/ui/Button';
import { BrandMarkIcon } from '@/components/shell/BrandMarkIcon';
import { CTA_LABELS } from '@/config/landing-page';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';

interface PublicStartBandProps {
  /** One sentence: why this visitor, having read this page, should start. */
  children: ReactNode;
  className?: string;
}

/**
 * The one way a public page ends: a sentence and the one warm action.
 *
 * The marketing pages each closed differently — a gradient card with "Create
 * Free Account", a near-black band with "Get Started Free", an orange band on
 * the wrong plan, and one page that ended by sending the visitor to another
 * product. One action had six names. This is the home page's band, shared, so
 * the action has one name (CTA_LABELS.primaryAction) and one target: the
 * register form, because the person tapping it has no account yet.
 */
export function PublicStartBand({ children, className }: PublicStartBandProps) {
  return (
    <div
      className={cn(
        'oc-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6',
        className
      )}
    >
      <p className="mb-0 flex-1 text-base text-fg-primary sm:text-lg">{children}</p>
      <Button href={ROUTES.AUTH_REGISTER} variant="accent" size="lg" className="w-full sm:w-auto">
        <BrandMarkIcon className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
        {CTA_LABELS.primaryAction}
      </Button>
    </div>
  );
}

export default PublicStartBand;

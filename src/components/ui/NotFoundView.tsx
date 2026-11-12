import type { LucideIcon } from 'lucide-react';
import Button from '@/components/ui/Button';

export interface NotFoundAction {
  href: string;
  label: string;
  icon?: LucideIcon;
  /** The one action that matters most; every other one is quieter. */
  primary?: boolean;
}

/**
 * The one shape every "not found" page takes: an icon, a title that is the
 * page's only <h1>, one sentence, and the ways onward.
 *
 * There were six: the site-wide page and five entity copies (project, profile,
 * loan, cause, investment) that differed only in their noun and icon, used a
 * card title (<h3>) as the page's only heading, and looked unlike the site-wide
 * one.
 */
export function NotFoundView({
  icon: Icon,
  title,
  message,
  actions,
  children,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  actions: NotFoundAction[];
  children?: React.ReactNode;
}) {
  return (
    <div className="oc-page flex items-center justify-center px-4 py-8">
      <div className="oc-surface w-full max-w-lg space-y-8 p-6">
        <div className="oc-icon-tile mx-auto h-16 w-16">
          <Icon className="h-8 w-8" aria-hidden />
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-semibold text-fg-primary">{title}</h1>
          <p className="mb-0 mt-3 text-base text-fg-secondary">{message}</p>
        </div>

        <div className="flex flex-col gap-3">
          {actions.map(({ href, label, icon: ActionIcon, primary }) => (
            <Button
              key={href + label}
              href={href}
              variant={primary ? 'primary' : 'outline'}
              size="lg"
              className="w-full"
            >
              {ActionIcon && <ActionIcon className="mr-2 h-4 w-4" aria-hidden />}
              {label}
            </Button>
          ))}
        </div>

        {children}
      </div>
    </div>
  );
}

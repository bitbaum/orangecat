import Link from 'next/link';
import type { ReactNode } from 'react';

interface DashboardSectionProps {
  id: string;
  title: string;
  /** One link at the right of the heading — "All 18", never a button. */
  action?: { label: string; href: string };
  /** A short line under the heading, for a number worth knowing. */
  note?: ReactNode;
  children: ReactNode;
}

/**
 * The dashboard's one section shape: a small caps heading, an optional link,
 * then the content. The same heading the My things page uses, so the two read
 * as one product. A section never gets its own card chrome around the
 * heading; a list inside it is the only bordered thing.
 */
export function DashboardSection({ id, title, action, note, children }: DashboardSectionProps) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">
          {title}
        </h2>
        {action && (
          <Link
            href={action.href}
            className="shrink-0 text-xs text-fg-tertiary hover:text-fg-primary hover:underline"
          >
            {action.label}
          </Link>
        )}
      </div>
      {note && <p className="mb-2 text-sm text-fg-secondary">{note}</p>}
      {children}
    </section>
  );
}

export default DashboardSection;

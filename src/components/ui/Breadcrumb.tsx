/**
 * Breadcrumb Navigation Component
 *
 * Shows the user where they are in the page hierarchy.
 * Uses entity-registry for consistent naming.
 */

import { Fragment } from 'react';
import Link from 'next/link';
import { ChevronRight, Compass, Home, type LucideIcon } from 'lucide-react';
import { ROUTES } from '@/config/routes';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** The first crumb: where the trail starts. */
export interface BreadcrumbRoot {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Signed-in app pages start at the dashboard. */
export const DASHBOARD_BREADCRUMB_ROOT: BreadcrumbRoot = {
  label: 'Home',
  href: ROUTES.DASHBOARD.HOME,
  icon: Home,
};

/**
 * Public listing pages start at Discover: "Home" there led a signed-out
 * visitor to the dashboard, which answers with the sign-in form.
 */
export const PUBLIC_BREADCRUMB_ROOT: BreadcrumbRoot = {
  label: 'Discover',
  href: ROUTES.DISCOVER,
  icon: Compass,
};

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  root?: BreadcrumbRoot;
}

export function Breadcrumb({
  items,
  className = '',
  root = DASHBOARD_BREADCRUMB_ROOT,
}: BreadcrumbProps) {
  const RootIcon = root.icon;
  return (
    // ONE flex row for every crumb, chevron, and label. Nesting each item in
    // its own `span.flex` created a second flex context whose box height
    // differed from the Home link's, so labels floated above the row —
    // the "made out of unrelated parts" misalignment. Siblings in a single
    // items-center context share one vertical axis by construction.
    <nav
      aria-label="Breadcrumb"
      className={`flex flex-wrap items-center gap-1.5 text-sm leading-none text-fg-secondary ${className}`}
    >
      <Link
        href={root.href}
        className="inline-flex items-center gap-1.5 hover:text-fg-primary transition-colors"
      >
        <RootIcon className="h-3.5 w-3.5 shrink-0" />
        <span>{root.label}</span>
      </Link>

      {items.map((item, i) => (
        <Fragment key={i}>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-fg-secondary/60" />
          {/* inline-flex items-center: globals.css forces a{min-height:44px} (touch
              targets), and a plain block link top-aligns its text inside that box
              while the Home link centers — THE breadcrumb misalignment. Center all
              links the same way inside the forced box. */}
          {item.href ? (
            <Link
              href={item.href}
              className="inline-flex items-center hover:text-fg-primary transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="inline-flex items-center text-fg-primary font-medium">
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

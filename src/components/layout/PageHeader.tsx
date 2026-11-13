/**
 * PageHeader — the SSOT for page chrome.
 *
 * One header for every page: optional breadcrumb → (optional icon +) title →
 * optional subtitle → optional badges, with optional right-aligned actions. Owns
 * its own internal spacing so callers never sprinkle `mb-4`/`mb-6` around it, and
 * renders the title via `oc-page-title` and the breadcrumb via the one Breadcrumb
 * component — so weight, font, tracking, separators and spacing are identical
 * everywhere. Drop it inside a page's `oc-page-stack` (or any container).
 *
 * Replaces the previously divergent headers in EntityListShell, EntityDetailLayout,
 * FormHeader, the public entity band, and ~62 ad-hoc <h1> blocks.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Breadcrumb, type BreadcrumbItem, type BreadcrumbRoot } from '@/components/ui/Breadcrumb';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Breadcrumb trail (excluding Home, which the component always prepends). */
  breadcrumbs?: BreadcrumbItem[];
  /** Where the trail starts; the dashboard unless a public page says Discover. */
  breadcrumbRoot?: BreadcrumbRoot;
  /**
   * Force-hide the breadcrumb. By default the breadcrumb shows only when there's
   * an explicit multi-segment trail — a single auto-crumb just repeats the title.
   */
  hideBreadcrumb?: boolean;
  /** Optional leading element (e.g. a type icon box or cover thumbnail). */
  icon?: ReactNode;
  /** Status/category chips rendered under the title. */
  badges?: ReactNode;
  /** Right-aligned actions (buttons, menus). */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  breadcrumbRoot,
  hideBreadcrumb = false,
  icon,
  badges,
  actions,
  className,
}: PageHeaderProps) {
  const crumbs = breadcrumbs ?? [{ label: title }];
  // A single auto-generated crumb just repeats the page title — only show the
  // breadcrumb for an explicit/real multi-segment trail.
  const showBreadcrumb = !hideBreadcrumb && (!!breadcrumbs || crumbs.length > 1);

  return (
    <div className={cn('space-y-4', className)}>
      {showBreadcrumb && <Breadcrumb items={crumbs} root={breadcrumbRoot} />}
      <div className="oc-page-header">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
          {icon}
          <div className="min-w-0">
            <h1 className="oc-page-title break-words">{title}</h1>
            {subtitle && <p className="oc-page-subtitle break-words">{subtitle}</p>}
            {badges && <div className="mt-2 flex flex-wrap items-center gap-2">{badges}</div>}
          </div>
        </div>
        {actions && (
          <div className="w-full flex-shrink-0 sm:w-auto">
            <div className="oc-page-actions">{actions}</div>
          </div>
        )}
      </div>
    </div>
  );
}

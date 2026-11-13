import { cn } from '@/lib/utils';

interface PageHeadingProps {
  children: React.ReactNode;
  /**
   * `page` is the title of a signed-in screen. `display` is the title of a
   * public page, one step larger at every width; use it through
   * `PublicPageHeader`, not directly.
   */
  size?: 'page' | 'display';
  /** Extra classes for the heading (e.g. text alignment). Never override the responsive scale. */
  className?: string;
}

const SIZE = {
  // The same scale as `.oc-page-title` (globals.css), which PageHeader uses:
  // two "canonical" titles one step apart at md made money pages and list
  // pages disagree on the size of a page's name.
  page: 'text-2xl sm:text-3xl',
  display: 'text-balance text-3xl sm:text-4xl lg:text-5xl',
} as const;

/**
 * Canonical page H1 — SSOT for the top-level heading scale, font, and tracking.
 * Mobile-first by construction, so every page that uses it looks right on small
 * screens. Public/marketing and detail pages should use this instead of
 * hand-rolling `text-4xl` headings (which don't scale down on phones).
 */
export function PageHeading({ children, size = 'page', className }: PageHeadingProps) {
  return (
    <h1
      className={cn(
        'font-heading tracking-display font-bold text-fg-primary break-words',
        SIZE[size],
        className
      )}
    >
      {children}
    </h1>
  );
}

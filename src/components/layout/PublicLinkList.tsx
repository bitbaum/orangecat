import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface PublicLinkRow {
  href: string;
  title: string;
  /** One line under the title: what is behind the link. */
  line: string;
}

interface PublicLinkListProps {
  rows: readonly PublicLinkRow[];
  /** Names the list for a screen reader when no heading sits right above it. */
  label?: string;
  className?: string;
}

/** Same-site paths go through next/link; mail and other sites are plain anchors. */
function isInternal(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}

/**
 * A list of places to go, on a public page: every row has one anatomy — a
 * name, one line on what is there, a chevron — and the whole row is the link,
 * at least 44px tall. One shape for every such list, so How it works and
 * About do not each draw their own.
 */
export function PublicLinkList({ rows, label, className }: PublicLinkListProps) {
  return (
    <ul aria-label={label} className={cn('space-y-2', className)}>
      {rows.map(row => {
        const body = (
          <>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-fg-primary">{row.title}</span>
              <span className="block text-sm leading-relaxed text-fg-secondary">{row.line}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden="true" />
          </>
        );
        const className = 'oc-list-row oc-card-link flex min-h-11 items-center gap-3';
        return (
          <li key={row.href}>
            {isInternal(row.href) ? (
              <Link href={row.href} className={className}>
                {body}
              </Link>
            ) : (
              <a
                href={row.href}
                className={className}
                {...(row.href.startsWith('http')
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                {body}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default PublicLinkList;

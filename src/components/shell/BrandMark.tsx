'use client';

import Link from 'next/link';
import { APP_NAME } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { BrandMarkIcon } from './BrandMarkIcon';

export interface BrandMarkProps {
  compact?: boolean;
  showWordmark?: boolean;
  href?: string;
  className?: string;
}

export function BrandMark({
  compact = false,
  showWordmark = true,
  href = ROUTES.HOME,
  className,
}: BrandMarkProps) {
  const markSize = compact ? 'ui-brand-mark-compact' : 'ui-brand-mark-default';
  const iconSize = compact ? 22 : 24;

  const content = (
    <div className={cn('flex min-w-0 items-center gap-2.5 sm:gap-3', className)}>
      <div
        className={cn(
          'ui-brand-mark text-fg-primary transition-transform hover:scale-[1.02] active:scale-[0.985]',
          markSize
        )}
      >
        <BrandMarkIcon size={iconSize} />
      </div>
      {showWordmark && !compact && (
        <span className="min-w-0 truncate text-base font-semibold tracking-tight text-fg-primary sm:text-lg">
          {APP_NAME}
        </span>
      )}
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link
      href={href}
      className="group inline-flex min-h-11 min-w-11 items-center rounded-md py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`${APP_NAME} — home`}
    >
      {content}
    </Link>
  );
}

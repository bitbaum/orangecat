import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Base Skeleton Component
 *
 * Usage:
 * <Skeleton className="h-4 w-full" />
 * <Skeleton className="h-12 w-12 rounded-full" />
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-surface-raised max-w-full', className)}
      {...props}
    />
  );
}

// Variant skeletons — imported from skeletons/ for backward-compatible re-export
export * from './skeletons/component-variants';
export * from './skeletons/page-variants';

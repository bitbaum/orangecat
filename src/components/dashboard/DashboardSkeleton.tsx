import { Skeleton } from '@/components/ui/Skeleton';

/**
 * The setup card's place while recommendations load: its header row and two
 * task rows, so the column below does not jump when the card arrives. Shown
 * only when the card is expected (see setup-card-memory).
 */
export function SetupCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={className} data-testid="setup-card-skeleton" aria-hidden="true">
      <div className="oc-surface oc-surface-padding space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-11 w-11" />
        </div>
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  );
}

/**
 * The dashboard while it loads: the same column as the page (greeting, the
 * door, then sections), drawn once. It is the route's loading.tsx AND what
 * the page shows until the account is known, so a person sees one skeleton
 * become the page — not a stale stats grid, then a full-screen spinner, then
 * the page (CLS 0.378 on a phone, measured 2026-11-13).
 */
export function DashboardSkeleton() {
  return (
    <div className="oc-page oc-interface" data-testid="dashboard-skeleton">
      <div className="oc-page-container pb-20 sm:pb-8">
        <div
          className="mx-auto max-w-2xl space-y-8"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="sr-only">Loading your dashboard</span>
          <div className="space-y-5">
            <div className="space-y-2">
              <Skeleton className="h-8 w-2/3 sm:h-9" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
          <SetupCardSkeleton />
          <div className="space-y-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

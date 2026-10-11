import { Skeleton, ProjectCardSkeleton, GridSkeleton } from '@/components/ui/Skeleton';

export default function DiscoverLoading() {
  return (
    <div className="space-y-8 p-4 md:p-6">
      {/* Hero / search bar skeleton */}
      <div className="space-y-4 text-center py-8">
        <Skeleton className="h-10 w-64 mx-auto" />
        <Skeleton className="h-4 w-full max-w-96 mx-auto" />
        <Skeleton className="h-12 w-full max-w-lg mx-auto rounded-full" />
      </div>

      {/* Tab bar skeleton */}
      <div className="flex gap-2 justify-center">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>

      {/* Results grid */}
      <GridSkeleton count={6} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <ProjectCardSkeleton />
      </GridSkeleton>
    </div>
  );
}

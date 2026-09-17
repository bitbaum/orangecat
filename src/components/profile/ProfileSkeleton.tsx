'use client';

/**
 * Skeleton loader for profile wallets section
 */
export function WalletsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-48 bg-surface-raised rounded animate-pulse" />
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2].map(i => (
          <div key={i} className="oc-surface p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-surface-raised rounded animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-32 bg-surface-raised rounded animate-pulse" />
                <div className="h-4 w-full bg-surface-raised rounded animate-pulse" />
                <div className="h-3 w-24 bg-surface-raised rounded animate-pulse" />
              </div>
            </div>
            <div className="bg-surface-raised rounded-lg p-3 mb-3">
              <div className="h-4 w-24 bg-surface-raised rounded animate-pulse mb-2" />
              <div className="h-6 w-40 bg-surface-raised rounded animate-pulse" />
            </div>
            <div className="h-2 w-full bg-surface-raised rounded animate-pulse mb-3" />
            <div className="h-16 w-full bg-surface-raised rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton loader for profile stats sidebar
 */
export function ProfileStatsSkeleton() {
  return (
    <div className="oc-surface p-6">
      <div className="h-6 w-32 bg-surface-raised rounded animate-pulse mb-4" />
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex justify-between items-center">
            <div className="h-4 w-24 bg-surface-raised rounded animate-pulse" />
            <div className="h-4 w-16 bg-surface-raised rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton loader for projects list
 */
export function ProjectsSkeleton() {
  return (
    <div className="oc-surface p-6">
      <div className="h-6 w-32 bg-surface-raised rounded animate-pulse mb-6" />
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="rounded-lg border-2 border-default bg-surface-base overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row">
              <div className="w-full sm:w-32 h-48 sm:h-auto flex-shrink-0 bg-surface-raised animate-pulse" />
              <div className="flex-1 p-4 sm:p-5">
                <div className="h-6 w-3/4 bg-surface-raised rounded animate-pulse mb-3" />
                <div className="h-4 w-full bg-surface-raised rounded animate-pulse mb-2" />
                <div className="h-4 w-5/6 bg-surface-raised rounded animate-pulse mb-4" />
                <div className="h-2 w-full bg-surface-raised rounded animate-pulse mb-2" />
                <div className="flex justify-between">
                  <div className="h-3 w-20 bg-surface-raised rounded animate-pulse" />
                  <div className="h-3 w-20 bg-surface-raised rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Complete profile skeleton for initial page load
 */
export function ProfilePageSkeleton() {
  return (
    <div className="min-h-screen bg-surface-page">
      {/* Every measurement below mirrors ProfileBannerSection / ProfileLayout.
          It used to guess: a 192px banner where the real one is 128px on a
          phone, a 96px avatar where the real one is 64px, a different inset and
          a different overhang. So the header visibly jumped — banner shrank,
          portrait slid — the moment real content replaced the skeleton, which
          is half of why the area read as thrown together. A skeleton that does
          not match is worse than no skeleton. */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
        {/* Header Banner Skeleton */}
        <div className="relative">
          <div className="relative h-32 sm:h-48 md:h-64 lg:h-80 bg-surface-raised border border-subtle rounded-lg sm:rounded-md shadow-none animate-pulse" />
          <div className="absolute z-10 -bottom-8 sm:-bottom-10 md:-bottom-12 lg:-bottom-16 left-4 sm:left-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-32 lg:h-32 rounded-lg bg-surface-raised border-2 sm:border-4 border-fg-inverted dark:border-default shadow-sm animate-pulse" />
          </div>
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 lg:top-6 lg:right-6 flex gap-2 sm:gap-3">
            <div className="h-10 w-24 bg-surface-raised rounded-lg animate-pulse" />
            <div className="h-10 w-32 bg-surface-raised rounded-lg animate-pulse" />
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-3 pt-12 sm:mt-4 sm:pt-14 md:pt-16 lg:pt-20">
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card Skeleton */}
            <div className="oc-surface p-6">
              <div className="h-8 w-48 bg-surface-raised rounded animate-pulse mb-3" />
              <div className="h-5 w-32 bg-surface-raised rounded animate-pulse mb-4" />
              <div className="h-4 w-full bg-surface-raised rounded animate-pulse mb-2" />
              <div className="h-4 w-5/6 bg-surface-raised rounded animate-pulse mb-4" />
              <div className="h-4 w-40 bg-surface-raised rounded animate-pulse" />
            </div>

            {/* Wallets Skeleton */}
            <WalletsSkeleton />

            {/* Projects Skeleton */}
            <ProjectsSkeleton />
          </div>

          {/* Right Column Skeleton */}
          <div className="space-y-6">
            <ProfileStatsSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

import { Skeleton } from '@/components/ui/Skeleton';

/** The shape of /discover while it loads: heading, field, kinds, a rail. */
export default function DiscoverLoading() {
  return (
    <div className="oc-discover">
      <div className="oc-discover-head space-y-4">
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-5 w-full max-w-xl" />
        <Skeleton className="h-14 w-full max-w-2xl" />
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-11 w-24" />
          ))}
        </div>
      </div>
      <Skeleton className="mb-4 h-7 w-40" />
      <div className="oc-discover-grid">
        {[0, 1, 2, 3].map(i => (
          <Skeleton key={i} className="aspect-[3/4] w-full" />
        ))}
      </div>
    </div>
  );
}

import { TimelinePostSkeleton, PageHeaderSkeleton } from '@/components/ui/Skeleton';

export default function TimelineLoading() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="p-4">
        <PageHeaderSkeleton />
      </div>

      {/* Post skeletons */}
      <div className="divide-y divide-subtle">
        <TimelinePostSkeleton />
        <TimelinePostSkeleton />
        <TimelinePostSkeleton />
        <TimelinePostSkeleton />
        <TimelinePostSkeleton />
      </div>
    </div>
  );
}

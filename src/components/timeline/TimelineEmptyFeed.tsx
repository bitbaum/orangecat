import type { LucideIcon } from 'lucide-react';
import Button from '@/components/ui/Button';
import { FOLLOWING_EMPTY, type FeedView } from '@/config/timeline';

/**
 * A feed that loaded and holds nothing, worded for the feed it is. An empty
 * following feed is about who you follow, not about posting: "Be the first to
 * share" sent people to write into a feed only they would read.
 */
export function TimelineEmptyFeed({ mode, icon: Icon }: { mode: FeedView; icon: LucideIcon }) {
  if (mode === 'following') {
    return (
      <div className="text-center py-16 px-4">
        <Icon className="w-20 h-20 text-fg-tertiary dark:text-fg-secondary mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-fg-primary mb-4">{FOLLOWING_EMPTY.title}</h3>
        <Button href={FOLLOWING_EMPTY.href} variant="primary">
          {FOLLOWING_EMPTY.action}
        </Button>
      </div>
    );
  }
  return (
    <div className="text-center py-16">
      <Icon className="w-20 h-20 text-fg-tertiary dark:text-fg-secondary mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-fg-primary mb-2">No posts yet</h3>
      <p className="text-fg-secondary max-w-md mx-auto">
        {mode === 'timeline'
          ? "Share your first update about what you're working on!"
          : 'Be the first to share something productive with the community!'}
      </p>
    </div>
  );
}

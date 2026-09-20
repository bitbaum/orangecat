/**
 * This used to render SettingsPageSkeleton — three bordered cards in a narrow
 * column, which is not what the Cat page looks like in any state. A skeleton
 * whose shape doesn't match the page it precedes is worse than none: it
 * animates one layout, then replaces it with a different one.
 *
 * ChatPageSkeleton already existed and already matches this route (rail,
 * toolbar, thread, composer).
 */
import { ChatPageSkeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return <ChatPageSkeleton />;
}

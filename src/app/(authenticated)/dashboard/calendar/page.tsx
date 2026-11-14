'use client';

/**
 * Your calendar (components/planner/CalendarView): a month, a week or a
 * list, and a microphone to add to it.
 */

import Loading from '@/components/Loading';
import { CalendarView } from '@/components/planner/CalendarView';
import { useRequireAuth } from '@/hooks/useAuth';

export default function CalendarPage() {
  const { user, isLoading } = useRequireAuth();
  if (isLoading || !user) {
    return <Loading fullScreen message="Loading your calendar..." />;
  }
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <CalendarView />
    </div>
  );
}

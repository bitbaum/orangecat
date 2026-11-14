'use client';

/**
 * Your calendar (components/planner/CalendarView): one line to add
 * something, and your coming days underneath.
 */

import Loading from '@/components/Loading';
import { CalendarView } from '@/components/planner/CalendarView';
import { useRequireAuth } from '@/hooks/useAuth';

export default function CalendarPage() {
  const { user, isLoading } = useRequireAuth();
  if (isLoading || !user) {
    return <Loading fullScreen message="Loading your calendar..." />;
  }
  return <CalendarView />;
}

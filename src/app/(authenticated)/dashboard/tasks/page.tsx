'use client';

/**
 * Tasks. The page a person lands on is their own list: one line to add,
 * one tap to tick off. The fuller view (recurring and requested tasks,
 * categories, filters, analytics) is one link away at `?view=all`.
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Loading from '@/components/Loading';
import { useRequireAuth } from '@/hooks/useAuth';
import MyListView from './components/MyListView';
import TeamTasksView from './components/TeamTasksView';

function TasksPageBody() {
  const { user, isLoading } = useRequireAuth();
  const all = useSearchParams()?.get('view') === 'all';
  if (isLoading || !user) {
    return <Loading fullScreen message="Loading your list..." />;
  }
  return all ? <TeamTasksView /> : <MyListView />;
}

export default function TasksPage() {
  return (
    <Suspense fallback={<Loading fullScreen message="Loading your list..." />}>
      <TasksPageBody />
    </Suspense>
  );
}

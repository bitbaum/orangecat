'use client';

import TasksSection from '@/components/dashboard/TasksSection';

/**
 * DashboardJourney - Recommended next steps for users
 *
 * DRY: All task/recommendation logic is in TasksSection (SSOT: useRecommendations hook)
 * This component is a thin wrapper that can be extended for journey-specific UI if needed.
 *
 * TasksSection handles:
 * - Profile completion tracking
 * - Task recommendations
 * - Celebration state when complete
 * - Loading/error states
 */
export function DashboardJourney() {
  // maxTasks=2 above the fold; "Show N more" is already wired inside
  // TasksSection. Five tasks on a mobile viewport train the eye to
  // skim past — two is the readable limit.
  // quietWhenDone: once setup is complete this renders nothing at all.
  return <TasksSection showQuestions={true} maxTasks={2} quietWhenDone />;
}

export default DashboardJourney;

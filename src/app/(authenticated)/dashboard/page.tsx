'use client';

import dynamic from 'next/dynamic';
import Loading from '@/components/Loading';
import {
  DashboardHeader,
  DashboardInviteCTA,
  DashboardJourney,
  DashboardQuickActions,
  DashboardProjects,
} from '@/components/dashboard/sections';
import { MobileDashboardSidebar } from '@/components/dashboard/MobileDashboardSidebar';
import { CatNudges } from '@/components/dashboard/CatNudges';
import { PendingActionsCard } from '@/components/ai-chat/PendingActionsCard';
import { useDashboard } from './useDashboard';

const DashboardTimeline = dynamic(
  () => import('@/components/dashboard/DashboardTimeline').then(mod => mod.DashboardTimeline),
  {
    ssr: false,
    loading: () => (
      <div className="oc-surface oc-surface-padding">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-surface-raised rounded w-1/4"></div>
          <div className="h-24 bg-surface-raised rounded"></div>
          <div className="h-24 bg-surface-raised rounded"></div>
        </div>
      </div>
    ),
  }
);

export default function DashboardPage() {
  const {
    user,
    profile,
    isLoading,
    hydrated,
    localLoading,
    timelineFeed,
    timelineLoading,
    timelineError,
    pendingActions,
    safeProjects,
    totalProjects,
    totalDrafts,
    hasProjects,
    sidebarStats,
    reloadTimeline,
    handleConfirmAction,
    handleRejectAction,
  } = useDashboard();

  // /dashboard renders the dashboard. It used to router.replace() everyone to
  // the Cat hub ("Cat-first", 2026-07-13), which made the surface unreachable:
  // the sidebar, the mobile tab bar, the breadcrumb "Dashboard" crumb, the 404
  // page and every RouteError recovery link all point here, so all of them
  // silently landed on /dashboard/cat — the destination the "Cat" nav item
  // already owned. Cat-first is still honoured where it belongs: sign-in goes
  // to CAT_WELCOME (auth/callback + auth/confirm) and "/" redirects to the Cat.

  if (!hydrated || localLoading) {
    return <Loading fullScreen message="Loading your account..." />;
  }

  if (!user && !isLoading) {
    return <Loading fullScreen message="Redirecting to login..." />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="oc-page">
      <div className="oc-page-container oc-page-stack pb-20 sm:pb-8">
        <DashboardHeader
          profile={profile}
          totalProjects={totalProjects}
          totalDrafts={totalDrafts}
        />

        {pendingActions.length > 0 && (
          <div className="space-y-3">
            {pendingActions.map(action => (
              <PendingActionsCard
                key={action.id}
                action={action}
                onConfirm={handleConfirmAction}
                onReject={handleRejectAction}
              />
            ))}
          </div>
        )}

        <DashboardJourney />

        <CatNudges />

        <div className="space-y-4 sm:space-y-6">
          <div className="block lg:hidden">
            <MobileDashboardSidebar stats={sidebarStats} />
          </div>
          {/* Your stuff (Projects) above the social feed (Timeline) —
              founders' work belongs above news. */}
          <div className="space-y-6">
            <DashboardProjects projects={safeProjects} />
            <DashboardTimeline
              timelineFeed={timelineFeed}
              isLoading={timelineLoading}
              error={timelineError}
              onRefresh={reloadTimeline}
              onPostSuccess={reloadTimeline}
              userId={user?.id}
            />
          </div>
        </div>

        <div className={hasProjects ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : ''}>
          <DashboardInviteCTA profile={profile} userId={user.id} />
          {hasProjects && <DashboardQuickActions />}
        </div>
      </div>
    </div>
  );
}

'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { ROUTES } from '@/config/routes';
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
  const router = useRouter();
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
    pendingActionsLoaded,
    safeProjects,
    totalProjects,
    totalDrafts,
    hasProjects,
    sidebarStats,
    reloadTimeline,
    handleConfirmAction,
    handleRejectAction,
  } = useDashboard();

  // Cat-first (2026-07-13, one-week plan C-1): the Cat is the DEFAULT surface.
  // Everyone landing on /dashboard is routed to their Cat hub — brand-new
  // accounts get the welcome variant, everyone else the plain hub. Dashboard
  // content stays reachable via the left nav (Timeline → ROUTES.TIMELINE,
  // entities via their own routes).
  //
  // Exception: if the timeline fetch errored we do NOT redirect — we render the
  // dashboard below so the user keeps a visible error + retry path instead of
  // being bounced away from a transient failure. (timelineFeed stays null on
  // error, which would otherwise look identical to "empty".)
  const isTrulyEmpty =
    hydrated &&
    !localLoading &&
    !timelineLoading &&
    !timelineError &&
    pendingActionsLoaded &&
    !hasProjects &&
    pendingActions.length === 0 &&
    (timelineFeed?.events?.length ?? 0) === 0;

  useEffect(() => {
    if (!hydrated || localLoading || !user || timelineError) {
      return;
    }
    if (isTrulyEmpty) {
      router.replace(ROUTES.DASHBOARD.CAT_WELCOME);
    } else if (!timelineLoading && pendingActionsLoaded) {
      router.replace(ROUTES.DASHBOARD.CAT);
    }
  }, [
    hydrated,
    localLoading,
    user,
    isTrulyEmpty,
    timelineLoading,
    pendingActionsLoaded,
    timelineError,
    router,
  ]);

  if (!hydrated || localLoading) {
    return <Loading fullScreen message="Loading your account..." />;
  }

  if (!user && !isLoading) {
    return <Loading fullScreen message="Redirecting to login..." />;
  }

  if (!user) {
    return null;
  }

  // Cat-first: show the redirect loader for everyone except the timeline-error
  // fallback (which renders the dashboard below so the user can retry).
  if (!timelineError) {
    return <Loading fullScreen message="Taking you to Cat..." />;
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
          <DashboardInviteCTA profile={profile} />
          {hasProjects && <DashboardQuickActions />}
        </div>
      </div>
    </div>
  );
}

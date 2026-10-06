'use client';

import dynamic from 'next/dynamic';
import Loading from '@/components/Loading';
import {
  DashboardHeader,
  DashboardInviteCTA,
  DashboardJourney,
  DashboardProjects,
  DashboardSection,
} from '@/components/dashboard/sections';
import { CatNudges } from '@/components/dashboard/CatNudges';
import { TheDoor } from '@/components/map/TheDoor';
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
    totalDrafts,
    projectStats,
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

  // One column, in the order a person asks: does anything need me (the
  // header line and the Cat's pending questions), what do I want to do (the
  // door), what could I do next (setup, while unfinished, and the Cat's
  // suggestions), what do I have (projects), what is everyone else doing (the
  // feed). Each section is a heading and one list — no card around a card.
  // It replaced a stack of a dozen cards where "18 projects" appeared three
  // times, three tiles said 0, a finished checklist kept its 100% bar, and
  // each project took a whole phone screen to show its first letter.
  return (
    <div className="oc-page">
      <div className="oc-page-container pb-20 sm:pb-8">
        <div className="mx-auto max-w-2xl space-y-8">
          <div className="space-y-5">
            <DashboardHeader
              profile={profile}
              waiting={pendingActions.length}
              totalDrafts={totalDrafts}
            />
            {/* The door: one sentence in, the right thing out. The Cat answers
                with a draft card, so this is the fastest route from wanting to
                having. */}
            <TheDoor />
          </div>

          {pendingActions.length > 0 && (
            <DashboardSection id="dashboard-needs-you" title="Needs you">
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
            </DashboardSection>
          )}

          <DashboardJourney />

          <CatNudges />

          <DashboardProjects projects={safeProjects} stats={projectStats} />

          <DashboardTimeline
            timelineFeed={timelineFeed}
            isLoading={timelineLoading}
            error={timelineError}
            onRefresh={reloadTimeline}
            onPostSuccess={reloadTimeline}
            userId={user?.id}
          />

          <DashboardInviteCTA profile={profile} userId={user.id} />
        </div>
      </div>
    </div>
  );
}

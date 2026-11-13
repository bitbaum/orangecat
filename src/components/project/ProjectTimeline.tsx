'use client';

import React, { useCallback, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Activity } from 'lucide-react';
import TimelineComposer from '@/components/timeline/TimelineComposer';
import TimelineView from '@/components/timeline/TimelineView';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { ROUTES } from '@/config/routes';

interface ProjectTimelineProps {
  projectId: string;
  projectTitle: string;
  isOwner: boolean;
}

export default function ProjectTimeline({
  projectId,
  projectTitle,
  isOwner: _isOwner,
}: ProjectTimelineProps) {
  const { user } = useAuth();
  const [showComposer, setShowComposer] = useState(false);
  const [timelineKey, setTimelineKey] = useState(0);

  const refreshTimeline = useCallback(() => {
    setTimelineKey(prev => prev + 1);
  }, []);

  const handlePostCreated = useCallback(() => {
    setShowComposer(false);
    refreshTimeline();
  }, [refreshTimeline]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-fg-primary" />
          <div>
            <h2 className="text-2xl font-semibold text-fg-primary">Project Updates</h2>
            <p className="text-sm text-fg-secondary">Insights and progress for {projectTitle}</p>
          </div>
        </div>
        {user && (
          <Button
            size="sm"
            variant={showComposer ? 'ghost' : 'secondary'}
            className="transition-all"
            onClick={() => setShowComposer(prev => !prev)}
          >
            {showComposer ? 'Cancel' : 'Post Update'}
          </Button>
        )}
      </div>

      {showComposer && user && (
        <TimelineComposer
          targetOwnerId={projectId}
          targetOwnerType="project"
          targetOwnerName={projectTitle}
          onPostCreated={handlePostCreated}
          onCancel={() => setShowComposer(false)}
          placeholder={`Share an update about ${projectTitle}...`}
          buttonText="Post Update"
          showBanner={false}
        />
      )}

      {!user && (
        <Card className="bg-surface-raised/40 border-subtle">
          <CardContent className="p-4">
            {/* "Sign in" with nothing to tap was a dead end; it now leads there and back. */}
            <p className="mb-0 text-sm text-fg-primary">
              <strong>Want to post updates?</strong>{' '}
              <Link
                href={`${ROUTES.AUTH_LOGIN}&from=${encodeURIComponent(ROUTES.PROJECTS.VIEW(projectId))}`}
                className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
              >
                Sign in
              </Link>{' '}
              to share progress about this project.
            </p>
          </CardContent>
        </Card>
      )}

      <TimelineView
        key={`project-timeline-${timelineKey}`}
        feedType="project"
        ownerId={projectId}
        ownerType="project"
        showComposer={false}
        compact={false}
        showFilters={false}
        emptyStateTitle="No updates yet"
        emptyStateDescription="Be the first to share a progress update."
        onPostCreated={handlePostCreated}
      />
    </div>
  );
}

/**
 * ProjectUpdatesTimeline Component
 *
 * Shows recent project updates, funding, and activity
 * Builds trust through transparency and demonstrates active engagement
 *
 * Created: 2025-11-17
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Activity, Bitcoin, MessageSquare, Trophy, TrendingUp } from 'lucide-react';
import { formatRelativeTime } from '@/utils/dates';
import { logger } from '@/utils/logger';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { API_ROUTES } from '@/config/api-routes';
import type { ProjectActivityItem } from '@/config/project-activity';

interface ProjectUpdatesTimelineProps {
  projectId: string;
  className?: string;
}

export function ProjectUpdatesTimeline({ projectId, className = '' }: ProjectUpdatesTimelineProps) {
  const { formatAmountBtc } = useDisplayCurrency();
  const [updates, setUpdates] = useState<ProjectActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);

  useEffect(() => {
    if (!projectId) {
      return;
    }
    const controller = new AbortController();
    const fetchUpdates = async () => {
      try {
        setLoading(true);
        const response = await fetch(API_ROUTES.PROJECTS.UPDATES(projectId), {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }

        if (response.ok) {
          const data = await response.json();
          if (controller.signal.aborted) {
            return;
          }
          setUpdates(data.data?.updates || []);
        } else {
          logger.warn('Failed to fetch project updates', { projectId }, 'ProjectUpdatesTimeline');
          setFetchFailed(true);
        }
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError') {
          return;
        }
        logger.error(
          'Error fetching project updates',
          { projectId, error },
          'ProjectUpdatesTimeline'
        );
        setFetchFailed(true);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchUpdates();
    return () => controller.abort();
  }, [projectId]);

  // Get icon based on update type
  const getUpdateIcon = (type: string) => {
    switch (type) {
      case 'donation':
        return <Bitcoin className="w-4 h-4 text-bitcoinOrange" />;
      case 'milestone':
        return <Trophy className="w-4 h-4 text-status-warning" />;
      case 'update':
      default:
        return <MessageSquare className="w-4 h-4 text-fg-primary" />;
    }
  };

  // Get background color based on type
  const getBackgroundColor = (type: string) => {
    switch (type) {
      case 'donation':
        return 'bg-bitcoinOrange/10';
      case 'milestone':
        return 'bg-status-warning-subtle';
      case 'update':
      default:
        return 'bg-surface-raised';
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-fg-tertiary animate-pulse" />
            <h3 className="text-lg font-semibold text-fg-tertiary">Loading activity...</h3>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3 pb-4 border-b animate-pulse">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-raised" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-surface-raised rounded w-3/4" />
                  <div className="h-3 bg-surface-raised rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-fg-primary" />
          Recent Activity
        </h3>

        {fetchFailed ? (
          <p className="text-sm text-fg-secondary">
            Could not load activity. Please refresh the page.
          </p>
        ) : updates.length > 0 ? (
          <div className="space-y-4">
            {updates.map(update => (
              <div key={update.id} className="flex gap-3 pb-4 border-b last:border-b-0 last:pb-0">
                {/* Icon based on type */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full ${getBackgroundColor(update.type)} flex items-center justify-center`}
                >
                  {getUpdateIcon(update.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-fg-primary">{update.title}</p>
                    {update.amount_btc && (
                      <span className="text-sm font-semibold text-bitcoin-text flex-shrink-0">
                        {formatAmountBtc(update.amount_btc)}
                      </span>
                    )}
                  </div>
                  {update.content && (
                    <p className="text-sm text-fg-secondary mt-1 line-clamp-2">{update.content}</p>
                  )}
                  <p className="text-xs text-fg-secondary mt-1 flex flex-wrap items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {formatRelativeTime(update.created_at)}
                    {update.source && (
                      <>
                        <span aria-hidden="true">·</span>
                        {update.source.url ? (
                          <a
                            href={update.source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-fg-primary"
                          >
                            via {update.source.label}
                          </a>
                        ) : (
                          <span>via {update.source.label}</span>
                        )}
                      </>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-raised flex items-center justify-center">
              <Activity className="w-8 h-8 text-fg-tertiary" />
            </div>
            <p className="text-sm text-fg-secondary mb-1">No recent activity yet</p>
            <p className="text-xs text-fg-tertiary">
              Updates will appear here as the project progresses
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

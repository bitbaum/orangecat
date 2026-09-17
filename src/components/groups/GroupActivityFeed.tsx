'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserPlus, FileText, Vote, CalendarPlus, Activity } from 'lucide-react';
import { API_ROUTES } from '@/config/api-routes';
import { logger } from '@/utils/logger';
import type { ActivityType } from '@/services/groups/types';
import { formatRelativeTimeFine } from '@/utils/dates';

interface ActivityUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface GroupActivity {
  id: string;
  activity_type: ActivityType;
  metadata: Record<string, unknown>;
  created_at: string;
  user_id: string;
  user: ActivityUser | null;
}

const ACTIVITY_CONFIG: Record<
  string,
  { icon: React.ElementType; label: (meta: Record<string, unknown>) => string; color: string }
> = {
  joined_group: {
    icon: UserPlus,
    label: () => 'joined the group',
    color: 'text-fg-secondary',
  },
  created_proposal: {
    icon: FileText,
    label: meta => (meta.title ? `created proposal "${meta.title}"` : 'created a proposal'),
    color: 'text-fg-secondary',
  },
  voted: {
    icon: Vote,
    label: meta => (meta.vote ? `voted ${meta.vote} on a proposal` : 'voted on a proposal'),
    color: 'text-fg-secondary',
  },
  created_event: {
    icon: CalendarPlus,
    label: meta => (meta.title ? `created event "${meta.title}"` : 'created an event'),
    color: 'text-fg-secondary',
  },
};

function displayName(user: ActivityUser | null): string {
  if (!user) {
    return 'Someone';
  }
  return user.name || user.username || 'A member';
}

function initials(user: ActivityUser | null): string {
  const name = displayName(user);
  return name.slice(0, 2).toUpperCase();
}

interface Props {
  groupSlug: string;
}

export function GroupActivityFeed({ groupSlug }: Props) {
  const [activities, setActivities] = useState<GroupActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const fetchActivities = async () => {
      try {
        const res = await fetch(API_ROUTES.GROUPS.ACTIVITIES(groupSlug), {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (controller.signal.aborted) {
            return;
          }
          setActivities(data.data?.activities ?? []);
        } else {
          logger.error(
            'Failed to fetch group activities',
            { status: res.status },
            'GroupActivityFeed'
          );
          setFetchError(true);
        }
      } catch (e) {
        if ((e as { name?: string }).name === 'AbortError') {
          return;
        }
        logger.error('Failed to fetch group activities', { error: e }, 'GroupActivityFeed');
        setFetchError(true);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };
    void fetchActivities();
    return () => controller.abort();
  }, [groupSlug]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (fetchError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Activity className="h-10 w-10 text-fg-secondary mb-3" />
            <p className="text-sm font-medium text-fg-primary">Could not load activity</p>
            <p className="text-xs text-fg-secondary mt-1">Try refreshing the page.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Activity className="h-10 w-10 text-fg-secondary mb-3" />
            <p className="text-sm font-medium text-fg-primary">No activity yet</p>
            <p className="text-xs text-fg-secondary mt-1">
              Activity will appear when members join, create proposals, vote, or schedule events.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          {activities.map(activity => {
            const config = ACTIVITY_CONFIG[activity.activity_type];
            const Icon = config?.icon ?? Activity;
            const label = config?.label(activity.metadata) ?? activity.activity_type;
            const iconColor = config?.color ?? 'text-fg-secondary';

            return (
              <li key={activity.id} className="flex items-start gap-3">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  {activity.user?.avatar_url && (
                    <AvatarImage src={activity.user.avatar_url} alt={displayName(activity.user)} />
                  )}
                  <AvatarFallback className="text-xs">{initials(activity.user)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-fg-primary leading-snug">
                    <span className="font-medium">{displayName(activity.user)}</span>{' '}
                    <span className="text-fg-secondary">{label}</span>
                  </p>
                  <p className="text-xs text-fg-secondary mt-0.5 flex items-center gap-1">
                    <Icon className={`h-3 w-3 ${iconColor}`} />
                    {formatRelativeTimeFine(activity.created_at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

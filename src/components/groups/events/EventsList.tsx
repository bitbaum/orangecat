/**
 * Events List Component
 *
 * Displays a list of events for a group with filtering and pagination.
 *
 * Created: 2025-12-31
 * Last Modified: 2025-12-31
 * Last Modified Summary: Initial implementation
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Plus, Loader2 } from 'lucide-react';
import { EventCard } from './EventCard';
import { CreateEventDialog } from './CreateEventDialog';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { useAuth } from '@/hooks/useAuth';
import type { GroupEvent } from '@/services/groups/types';
import { API_ROUTES } from '@/config/api-routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface EventsListProps {
  groupId: string;
  groupSlug: string;
  canCreateEvent?: boolean;
}

type EventStatusFilter = 'all' | 'upcoming' | 'past';

export function EventsList({ groupId, groupSlug, canCreateEvent = false }: EventsListProps) {
  const { user: _user } = useAuth();
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<EventStatusFilter>('upcoming');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const loadIdRef = useRef(0);

  const loadEvents = useCallback(async () => {
    const myLoadId = ++loadIdRef.current;
    try {
      setLoading(true);
      setError(false);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      params.append('limit', '50');

      const response = await fetch(`${API_ROUTES.GROUPS.EVENTS(groupSlug)}?${params.toString()}`);
      if (myLoadId !== loadIdRef.current) {
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to load events');
      }

      const data = await response.json();
      if (myLoadId !== loadIdRef.current) {
        return;
      }
      if (data.success) {
        setEvents(data.data?.events || []);
      } else {
        throw new Error(apiErrorMessage(data, 'Failed to load events'));
      }
    } catch (error) {
      if (myLoadId !== loadIdRef.current) {
        return;
      }
      logger.error('Failed to load events:', error);
      setError(true);
      toast.error('Failed to load events');
    } finally {
      if (myLoadId === loadIdRef.current) {
        setLoading(false);
      }
    }
  }, [groupSlug, statusFilter]);

  useEffect(() => {
    loadEvents();
    return () => {
      // Bump id so any in-flight load cannot setState after unmount or dep change.
      // Deliberate write to the live ref — not stale-read.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      loadIdRef.current++;
    };
  }, [groupId, statusFilter, loadEvents]);

  const handleEventCreated = () => {
    setCreateDialogOpen(false);
    loadEvents();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-fg-tertiary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <p className="text-sm text-fg-secondary">Couldn’t load events.</p>
          <Button variant="outline" size="sm" onClick={() => loadEvents()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Events</h3>
          <p className="text-sm text-fg-secondary">Manage group events and RSVPs</p>
        </div>
        {canCreateEvent && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as EventStatusFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="past">Past</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-fg-tertiary mb-4" />
            <h3 className="text-lg font-semibold mb-2">No events yet</h3>
            <p className="text-fg-secondary text-center mb-4">
              {statusFilter === 'upcoming'
                ? 'No upcoming events scheduled.'
                : statusFilter === 'past'
                  ? 'No past events.'
                  : 'Create your first event to get started.'}
            </p>
            {canCreateEvent && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Event
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map(event => (
            <EventCard key={event.id} event={event} groupSlug={groupSlug} onUpdate={loadEvents} />
          ))}
        </div>
      )}

      {createDialogOpen && (
        <CreateEventDialog
          groupId={groupId}
          groupSlug={groupSlug}
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onSuccess={handleEventCreated}
        />
      )}
    </div>
  );
}

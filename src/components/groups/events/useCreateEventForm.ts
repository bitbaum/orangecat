'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { groupEventSchema, type GroupEventFormData } from '@/lib/validation/groups';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';

export function useCreateEventForm(
  groupSlug: string,
  onSuccess: (() => void) | undefined,
  onClose: () => void
) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<GroupEventFormData>({
    resolver: zodResolver(groupEventSchema),
    defaultValues: {
      title: '',
      description: '',
      event_type: 'general',
      location_type: 'online',
      location_details: '',
      starts_at: '',
      ends_at: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      max_attendees: undefined,
      is_public: true,
      requires_rsvp: false,
    },
  });

  const onSubmit = async (data: GroupEventFormData) => {
    try {
      setSubmitting(true);

      const startsAt = new Date(data.starts_at).toISOString();
      const endsAt = data.ends_at ? new Date(data.ends_at).toISOString() : undefined;

      const response = await fetch(API_ROUTES.GROUPS.EVENTS(groupSlug), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, starts_at: startsAt, ends_at: endsAt }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(apiErrorMessage(result, 'Failed to create event'));
      }

      toast.success('Event created successfully');
      form.reset();
      onSuccess?.();
      onClose();
    } catch (error) {
      logger.error('Failed to create event:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  const getLocalDateTime = (minutesFromNow = 0) => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + minutesFromNow);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${mins}`;
  };

  return { form, submitting, onSubmit, getLocalDateTime };
}

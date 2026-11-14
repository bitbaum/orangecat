'use client';

/**
 * The calendar's data for one span of days, by day, reloaded on demand.
 * The server writes every time in the person's own clock (calendar-page.ts),
 * so nothing here formats or converts a date.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import type { CalendarPage, CalendarPageRow } from '@/services/planner/calendar-page';
import { browserTimeZone } from '@/utils/timezone';
import { logger } from '@/utils/logger';

export interface CalendarData {
  page: CalendarPage | null;
  /** Rows by day, `YYYY-MM-DD`. */
  byDay: ReadonlyMap<string, CalendarPageRow[]>;
  failed: boolean;
  loading: boolean;
  reload: () => Promise<void>;
}

const EMPTY = new Map<string, CalendarPageRow[]>();

export function useCalendarData(from: string, to: string): CalendarData {
  const [page, setPage] = useState<CalendarPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const asked = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++asked.current;
    setLoading(true);
    try {
      const q = new URLSearchParams({ from, to, zone: browserTimeZone() });
      const res = await fetch(`${API_ROUTES.CALENDAR.BASE}?${q.toString()}`);
      const json = (await res.json()) as { data?: CalendarPage };
      if (!res.ok || !json.data) {
        throw new Error('calendar not loaded');
      }
      // A slower answer for a span the person already left is not shown.
      if (mine === asked.current) {
        setPage(json.data);
        setFailed(false);
      }
    } catch (error) {
      logger.error('calendar load failed', error, 'useCalendarData');
      if (mine === asked.current) {
        setFailed(true);
      }
    } finally {
      if (mine === asked.current) {
        setLoading(false);
      }
    }
  }, [from, to]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // All day first, then by the hour, whatever order they arrived in.
  const byDay = page
    ? new Map(
        page.byDay.map(d => [
          d.day,
          [...d.rows].sort((a, b) => (a.startMinute ?? -1) - (b.startMinute ?? -1)),
        ])
      )
    : EMPTY;
  return { page, byDay, failed, loading, reload };
}

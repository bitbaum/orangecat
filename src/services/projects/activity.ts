/**
 * Project Activity Service
 *
 * Reads the activity shown on a project page.
 *
 * This used to read `project_updates`, a table nothing has ever written — so
 * every project rendered "No recent activity yet" no matter how much had
 * happened. Real project activity lives in `timeline_events`, keyed by
 * subject_type/subject_id, which is also where the external publish bus lands
 * updates from sibling products (Loki). One store, one reader.
 *
 * Created: 2026-08-24
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { getExternalAttribution } from '@/config/external-publish';
import {
  PROJECT_ACTIVITY_LIMIT,
  projectActivityKind,
  type ProjectActivityItem,
} from '@/config/project-activity';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';

interface TimelineEventRow {
  id: string;
  event_type: string;
  title: string | null;
  description: string | null;
  amount_btc: number | null;
  event_timestamp: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface ListOptions {
  /** The owner previewing their own project sees non-public updates too. */
  includeNonPublic: boolean;
}

export interface ProjectActivityResult {
  success: boolean;
  data?: ProjectActivityItem[];
  error?: string;
}

export async function listProjectActivity(
  db: AnySupabaseClient,
  projectId: string,
  { includeNonPublic }: ListOptions
): Promise<ProjectActivityResult> {
  let query = db
    .from(DATABASE_TABLES.TIMELINE_EVENTS)
    .select('id, event_type, title, description, amount_btc, event_timestamp, created_at, metadata')
    .eq('subject_type', 'project')
    .eq('subject_id', projectId)
    .eq('is_deleted', false)
    .order('event_timestamp', { ascending: false })
    .limit(PROJECT_ACTIVITY_LIMIT);

  if (!includeNonPublic) {
    query = query.eq('visibility', 'public');
  }

  const { data, error } = await query;

  if (error) {
    logger.error(
      'Project activity query failed',
      { projectId, error: error.message },
      'ProjectActivityService'
    );
    return { success: false, error: error.message };
  }

  const rows = (data ?? []) as unknown as TimelineEventRow[];
  return { success: true, data: rows.map(row => toActivityItem(row, projectId)) };
}

function toActivityItem(row: TimelineEventRow, projectId: string): ProjectActivityItem {
  const attribution = getExternalAttribution(row.metadata);
  const amountBtc = row.amount_btc ?? undefined;

  return {
    id: row.id,
    project_id: projectId,
    type: projectActivityKind(row.event_type, amountBtc),
    // An event always carries a title; fall back rather than render an empty row.
    title: row.title?.trim() || 'Update',
    ...(row.description ? { content: row.description } : {}),
    ...(amountBtc !== undefined ? { amount_btc: amountBtc } : {}),
    created_at: row.event_timestamp ?? row.created_at,
    ...(attribution
      ? {
          source: {
            label: attribution.sourceLabel,
            ...(attribution.url ? { url: attribution.url } : {}),
          },
        }
      : {}),
  };
}

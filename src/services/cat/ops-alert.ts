/**
 * One unread operational alert per problem, bumped rather than stacked.
 *
 * Extracted from `failure-alert.ts`, which worked out the shape and then became
 * the only thing that had it. A second alert path copying this upsert would
 * have been a second set of coalescing rules to drift — and the whole reason
 * this codebase keeps finding "the gate reached nobody" bugs is that each
 * signal was wired its own way.
 *
 * Deliberately quiet: one unread row per CODE, `occurrences` bumped. A provider
 * outage hits every user at once, so a row per affected request would bury the
 * signal it exists to raise.
 */
import { getAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';

/** Recipient of operational alerts. Same default as scripts/eval-cat.mjs. */
export const OPS_NOTIFY_USER_ID =
  process.env.OPS_NOTIFY_USER_ID || 'cec88bc9-557f-452b-92f1-e093092fecd6';

export interface OpsAlert {
  /** Stable identifier for the PROBLEM, not this occurrence. Coalesced on. */
  code: string;
  /** What the operator reads. */
  message: string;
  /** Which subsystem raised it, so two subsystems cannot collide on a code. */
  source: string;
  /** Anything else worth triaging with. */
  metadata?: Record<string, unknown>;
}

/**
 * Raise or bump an operational alert. Never throws: an alert that breaks the
 * thing it was reporting on is worse than no alert.
 */
export async function alertOps(alert: OpsAlert): Promise<void> {
  try {
    const supabase = getAdminClient();
    // Deep-links into the Cat so the first stop is something that can explain
    // the message, rather than a log file.
    const question = `Help me with this notification: ${alert.code} — "${alert.message}" What does it mean and what should I do?`;
    const actionUrl = `/dashboard/cat?q=${encodeURIComponent(question)}`;

    const { data: existing } = await supabase
      .from(DATABASE_TABLES.NOTIFICATIONS)
      .select('id, metadata')
      .eq('user_id', OPS_NOTIFY_USER_ID)
      .eq('type', 'system')
      .eq('is_read', false)
      .eq('metadata->>source', alert.source)
      .eq('metadata->>title', alert.code)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const metadata = {
      ...(alert.metadata ?? {}),
      title: alert.code,
      source: alert.source,
      lastSeenAt: new Date().toISOString(),
    };

    if (existing) {
      const prev = (existing.metadata ?? {}) as { occurrences?: number };
      await supabase
        .from(DATABASE_TABLES.NOTIFICATIONS)
        .update({
          message: alert.message,
          action_url: actionUrl,
          metadata: { ...metadata, occurrences: (Number(prev.occurrences) || 1) + 1 },
        })
        .eq('id', existing.id);
      return;
    }

    await supabase.from(DATABASE_TABLES.NOTIFICATIONS).insert({
      user_id: OPS_NOTIFY_USER_ID,
      type: 'system',
      message: alert.message,
      action_url: actionUrl,
      metadata: { ...metadata, occurrences: 1 },
      is_read: false,
    });
  } catch (err) {
    logger.warn('Failed to raise ops alert', { err, code: alert.code }, alert.source);
  }
}

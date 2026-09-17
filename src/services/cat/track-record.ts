/**
 * Cat track record — the outcome feedback loop.
 *
 * Derives what actually HAPPENED to the entities Cat created with the user:
 * proposed → published → funded, grounded in real platform state instead of
 * model self-assessment. Zero new state: the proposal side is the existing
 * cat_action_log audit trail (create_* actions), the outcome side is the
 * entity tables themselves plus settled payment_intents. If state lives in
 * one place it can't disagree with itself — this module only ever reads.
 *
 * Fed into Cat's context (see context-sections.renderTrackRecord) so advice
 * is anchored in the user's observed results ("your priced-under-X services
 * got funded; the drafts from May never published") rather than vibes.
 *
 * Every path degrades gracefully: any query error or missing table returns
 * null / skips the row — Cat keeps working without the signal.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { ENTITY_REGISTRY, ENTITY_TYPES, type EntityType } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';

// ==================== TYPES ====================

export interface TrackRecordEntry {
  entityType: EntityType;
  entityId: string;
  title: string;
  /** When Cat created it (action log timestamp). */
  createdAt: string;
  /** Current status of the entity ('active', 'draft', …) or null if it no longer exists. */
  status: string | null;
  /** BTC actually received via settled payment intents (0 when none). */
  fundedBtc: number;
  /** Number of settled payments behind fundedBtc. */
  payments: number;
}

/** A concrete thing that went wrong — the loss side of the feedback loop. */
export interface TrackRecordSetback {
  actionId: string;
  /** failed = handler errored · denied = permission/spend-cap refusal ·
   *  expired/rejected = a confirmation the user never gave / turned down. */
  kind: 'failed' | 'denied' | 'expired' | 'rejected';
  /** Recorded reason, when one exists. */
  reason: string | null;
  at: string;
}

export interface CatTrackRecord {
  /** Completed create_* actions found in the window. */
  proposed: number;
  /** Entries whose entity currently has status 'active'. */
  published: number;
  /** Entries with at least one settled payment. */
  funded: number;
  totalFundedBtc: number;
  /** Most recent first; capped at MAX_ENTRIES. */
  entries: TrackRecordEntry[];
  /** Failed + denied actions and expired/rejected confirmations in the window.
   *  Without these the record is survivorship-biased: an agent that only
   *  remembers wins re-proposes its losses forever. */
  setbacks: {
    failed: number;
    denied: number;
    unconfirmed: number;
    /** Most recent first; capped at MAX_SETBACKS. */
    recent: TrackRecordSetback[];
  };
  windowDays: number;
}

// ==================== CONSTANTS ====================

/** How far back to look for Cat-created entities. */
const WINDOW_DAYS = 90;
/** Cap the per-entity list injected into context / returned to the UI. */
const MAX_ENTRIES = 12;
/** payment_intents statuses that mean money actually arrived (or the buyer says it did). */
const SETTLED_INTENT_STATUSES = ['paid', 'buyer_confirmed'];
/** Entity status that counts as published. */
const PUBLISHED_STATUS = 'active';
/** Cap the setback list injected into context / returned to the UI. */
const MAX_SETBACKS = 6;
/** Log statuses that count as setbacks ('denied' exists from migration
 *  20260802140000; on an un-migrated DB the .in() filter simply errors and the
 *  whole setback block degrades to empty — the funnel is unaffected). */
const SETBACK_LOG_STATUSES = ['failed', 'denied'];
/** Pending-confirmation outcomes where the human said no (or nothing). */
const UNCONFIRMED_STATUSES = ['expired', 'rejected'];

/**
 * SSOT mapping: the Cat's entity-creating action ids are `create_<type>` for
 * every registry type (only some have handlers today — unknown ids simply
 * never appear in the log, so deriving from the registry stays correct as
 * handlers are added).
 */
const CREATE_ACTION_TO_TYPE: ReadonlyMap<string, EntityType> = new Map(
  ENTITY_TYPES.map(type => [`create_${type}`, type])
);

// ==================== DERIVATION ====================

interface LogRow {
  action_id: string;
  result: { id?: unknown; title?: unknown } | null;
  completed_at: string | null;
  created_at: string;
}

/**
 * Compute the user's Cat track record for the recent window.
 * Returns null when the proposal log is unavailable; an empty record (proposed
 * 0) when the log is readable but Cat hasn't created anything in the window.
 */
export async function getCatTrackRecord(
  supabase: AnySupabaseClient,
  userId: string
): Promise<CatTrackRecord | null> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: logRows, error: logError } = await supabase
    .from(DATABASE_TABLES.CAT_ACTION_LOG)
    .select('action_id, result, completed_at, created_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .in('action_id', [...CREATE_ACTION_TO_TYPE.keys()])
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (logError) {
    logger.warn('Track record unavailable', { error: logError.message }, 'CatTrackRecord');
    return null;
  }

  // Loss side — failed/denied actions and unconfirmed proposals. Fetched
  // before the empty-proposals early return: a Cat whose every action was
  // denied has an EMPTY funnel and a full setback list, and that record is
  // exactly the one it most needs to see.
  const setbacks = await getSetbacks(supabase, userId, since);

  // Proposal side: completed create_* actions whose result carries the entity id.
  const proposals: Array<{ entityType: EntityType; entityId: string; createdAt: string }> = [];
  for (const row of (logRows || []) as LogRow[]) {
    const entityType = CREATE_ACTION_TO_TYPE.get(row.action_id);
    const entityId = row.result && typeof row.result.id === 'string' ? row.result.id : null;
    if (entityType && entityId) {
      proposals.push({ entityType, entityId, createdAt: row.completed_at || row.created_at });
    }
  }

  if (proposals.length === 0) {
    return {
      proposed: 0,
      published: 0,
      funded: 0,
      totalFundedBtc: 0,
      entries: [],
      setbacks,
      windowDays: WINDOW_DAYS,
    };
  }

  const recent = proposals.slice(0, MAX_ENTRIES);

  // Outcome side 1 — current entity state, one query per entity type present.
  const idsByType = new Map<EntityType, string[]>();
  for (const p of recent) {
    idsByType.set(p.entityType, [...(idsByType.get(p.entityType) || []), p.entityId]);
  }
  const entityState = new Map<string, { title: string; status: string }>();
  await Promise.all(
    [...idsByType.entries()].map(async ([type, ids]) => {
      const { data, error } = await supabase
        .from(ENTITY_REGISTRY[type].tableName)
        .select('id, title, status')
        .in('id', ids);
      if (error) {
        logger.warn(
          'Track record entity lookup failed',
          { type, error: error.message },
          'CatTrackRecord'
        );
        return;
      }
      for (const row of data || []) {
        entityState.set(row.id, { title: row.title ?? '(untitled)', status: row.status ?? null });
      }
    })
  );

  // Outcome side 2 — settled payments toward those entities.
  const funding = new Map<string, { btc: number; payments: number }>();
  const { data: intents, error: intentsError } = await supabase
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .select('entity_id, amount_btc, status')
    .in(
      'entity_id',
      recent.map(p => p.entityId)
    )
    .in('status', SETTLED_INTENT_STATUSES);
  if (intentsError) {
    logger.warn(
      'Track record funding lookup failed',
      { error: intentsError.message },
      'CatTrackRecord'
    );
  } else {
    for (const intent of intents || []) {
      const prev = funding.get(intent.entity_id) || { btc: 0, payments: 0 };
      funding.set(intent.entity_id, {
        btc: prev.btc + Number(intent.amount_btc || 0),
        payments: prev.payments + 1,
      });
    }
  }

  const entries: TrackRecordEntry[] = recent.map(p => {
    const state = entityState.get(p.entityId) || null;
    const funded = funding.get(p.entityId) || { btc: 0, payments: 0 };
    return {
      entityType: p.entityType,
      entityId: p.entityId,
      title: state?.title ?? '(deleted)',
      createdAt: p.createdAt,
      status: state?.status ?? null,
      fundedBtc: funded.btc,
      payments: funded.payments,
    };
  });

  return {
    proposed: proposals.length,
    published: entries.filter(e => e.status === PUBLISHED_STATUS).length,
    funded: entries.filter(e => e.fundedBtc > 0).length,
    totalFundedBtc: entries.reduce((sum, e) => sum + e.fundedBtc, 0),
    entries,
    setbacks,
    windowDays: WINDOW_DAYS,
  };
}

/**
 * Derive the loss side: failed + denied log rows and expired/rejected pending
 * confirmations. Both sources degrade to zero on any error (e.g. a DB that
 * predates the 'denied' enum value) — the funnel never depends on them.
 */
async function getSetbacks(
  supabase: AnySupabaseClient,
  userId: string,
  since: string
): Promise<CatTrackRecord['setbacks']> {
  const [logRes, pendingRes] = await Promise.all([
    supabase
      .from(DATABASE_TABLES.CAT_ACTION_LOG)
      .select('action_id, status, error_message, created_at')
      .eq('user_id', userId)
      .in('status', SETBACK_LOG_STATUSES)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from(DATABASE_TABLES.CAT_PENDING_ACTIONS)
      .select('action_id, status, rejection_reason, created_at')
      .eq('user_id', userId)
      .in('status', UNCONFIRMED_STATUSES)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (logRes.error) {
    logger.warn('Setback log lookup failed', { error: logRes.error.message }, 'CatTrackRecord');
  }
  if (pendingRes.error) {
    logger.warn(
      'Setback pending lookup failed',
      { error: pendingRes.error.message },
      'CatTrackRecord'
    );
  }

  const fromLog: TrackRecordSetback[] = (logRes.data || []).map(row => ({
    actionId: row.action_id,
    kind: row.status === 'denied' ? 'denied' : 'failed',
    reason: row.error_message ?? null,
    at: row.created_at,
  }));
  const fromPending: TrackRecordSetback[] = (pendingRes.data || []).map(row => ({
    actionId: row.action_id,
    kind: row.status === 'rejected' ? 'rejected' : 'expired',
    reason: row.rejection_reason ?? null,
    at: row.created_at,
  }));

  return {
    failed: fromLog.filter(s => s.kind === 'failed').length,
    denied: fromLog.filter(s => s.kind === 'denied').length,
    unconfirmed: fromPending.length,
    recent: [...fromLog, ...fromPending]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, MAX_SETBACKS),
  };
}

// ==================== TOOL OUTPUT ====================

/**
 * The track record as prose for the model, when Cat CALLS for it (ADR-0006 D6)
 * rather than receiving it as ambient context. Separate from
 * context-sections.renderTrackRecord on purpose: that rendering is pinned by a
 * snapshot test and tuned as a background section; this one answers a direct
 * question ("what did you do for me?") and, more usefully, names Cat's own
 * pattern so it can act on it — "three drafted, none published" is a fact Cat
 * should notice before proposing a fourth.
 *
 * Prose, not JSON: weak models paraphrase prose and echo JSON.
 */
export function formatTrackRecordForModel(tr: CatTrackRecord | null): string {
  if (!tr) {
    return 'TRACK RECORD: could not be read (the action log was unavailable). Tell the user you cannot see your own history right now — do not reconstruct it from memory.';
  }
  const setbackCount = tr.setbacks.failed + tr.setbacks.denied + tr.setbacks.unconfirmed;
  if (tr.proposed === 0 && setbackCount === 0) {
    return `TRACK RECORD (last ${tr.windowDays} days): nothing yet. You have not created anything for this user in this window and nothing failed. Say so plainly; do not invent history.`;
  }

  const lines: string[] = [];
  lines.push(
    `TRACK RECORD (last ${tr.windowDays} days, real outcomes): proposed ${tr.proposed}, published ${tr.published} (active now), funded ${tr.funded}` +
      (tr.funded > 0 ? ` for ${tr.totalFundedBtc} BTC in total.` : '.')
  );

  if (tr.entries.length > 0) {
    lines.push('What you created, most recent first:');
    for (const e of tr.entries) {
      const state = e.status === null ? 'deleted since' : `status ${e.status}`;
      const money = e.payments > 0 ? `, ${e.fundedBtc} BTC from ${e.payments} payment(s)` : '';
      lines.push(`- ${e.entityType} "${e.title}" — ${state}${money} (created ${e.createdAt.slice(0, 10)})`);
    }
  }

  if (setbackCount > 0) {
    lines.push(
      `Setbacks: ${tr.setbacks.failed} failed, ${tr.setbacks.denied} denied (permission or spend cap), ${tr.setbacks.unconfirmed} never confirmed by the user.`
    );
    for (const sb of tr.setbacks.recent) {
      lines.push(`- ${sb.actionId}: ${sb.kind}${sb.reason ? ` — ${sb.reason}` : ''} (${sb.at.slice(0, 10)})`);
    }
  }

  // The pattern is the point. State it as a fact so the model acts on it
  // instead of re-proposing the same thing a fourth time.
  const drafts = tr.entries.filter(e => e.status === 'draft').length;
  const patterns: string[] = [];
  if (drafts >= 2 && tr.published === 0) {
    patterns.push(
      `${drafts} things drafted, none published — offer to finish ONE of them (name it) before creating anything new.`
    );
  } else if (drafts >= 2) {
    patterns.push(`${drafts} drafts are sitting unpublished — worth offering to finish one.`);
  }
  if (tr.published > 0 && tr.funded === 0) {
    patterns.push(
      `${tr.published} published but nothing funded yet — the gap is reach or pricing, not more listings.`
    );
  }
  if (tr.setbacks.unconfirmed >= 2) {
    patterns.push(
      `${tr.setbacks.unconfirmed} proposals the user never confirmed — ask what held them back before proposing the same kind again.`
    );
  }
  if (patterns.length > 0) {
    lines.push('PATTERN: ' + patterns.join(' '));
  }

  lines.push(
    'Answer from THESE lines only. Amounts are BTC. Own the setbacks in the first person; never claim an outcome not listed here.'
  );
  return lines.join('\n');
}

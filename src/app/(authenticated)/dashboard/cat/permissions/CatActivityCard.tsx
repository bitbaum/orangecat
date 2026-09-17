'use client';

/**
 * CatActivityCard — read-only audit trail of what Cat actually did.
 *
 * Renders the user's recent cat_action_log rows (the table the action
 * executor already writes; RLS limits reads to own rows). Pure view — no
 * new bookkeeping, no mutations. Lives on the permissions page so "what
 * can Cat do" and "what did Cat do" sit together.
 */

import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { supabase } from '@/lib/supabase/browser';
import { DATABASE_TABLES } from '@/config/database-tables';
import { CAT_ACTIONS } from '@/config/cat-actions';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { logger } from '@/utils/logger';
import { APP_LOCALE } from '@/utils/locale';

const ACTIVITY_LIMIT = 20;

type ActionStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';

interface ActivityRow {
  id: string;
  action_id: string;
  status: ActionStatus;
  amount_btc: number | null;
  error_message: string | null;
  requested_at: string;
}

const STATUS_STYLES: Record<ActionStatus, { label: string; className: string }> = {
  completed: {
    label: 'Done',
    className: 'border-status-positive/30 bg-status-positive-subtle text-status-positive',
  },
  failed: {
    label: 'Failed',
    className: 'border-status-negative/30 bg-status-negative/10 text-status-negative',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'border-subtle bg-surface-raised text-fg-secondary',
  },
  pending: {
    label: 'Pending',
    className: 'border-status-warning/30 bg-status-warning-subtle text-status-warning',
  },
  executing: {
    label: 'Running',
    className: 'border-status-warning/30 bg-status-warning-subtle text-status-warning',
  },
};

export function CatActivityCard({ userId }: { userId: string }) {
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const { formatAmountBtc } = useDisplayCurrency();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from(DATABASE_TABLES.CAT_ACTION_LOG)
        .select('id, action_id, status, amount_btc, error_message, requested_at')
        .eq('user_id', userId)
        .order('requested_at', { ascending: false })
        .limit(ACTIVITY_LIMIT);
      if (cancelled) {
        return;
      }
      if (error) {
        logger.error('Failed to load Cat activity', error, 'CatPermissions');
        setRows([]);
        return;
      }
      setRows((data as ActivityRow[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="mt-6 rounded-lg border border-default bg-surface-base p-6">
      <div className="mb-1 flex items-center gap-2">
        <History className="h-5 w-5 text-fg-secondary" />
        <h2 className="text-lg font-semibold text-fg-primary">Recent Cat activity</h2>
      </div>
      <p className="mb-4 text-sm text-fg-secondary">
        Everything Cat has done on your behalf — the audit trail behind the permissions above.
      </p>

      {rows === null ? (
        <p className="text-sm text-fg-tertiary">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-fg-tertiary">
          No actions yet. When Cat creates something, sends a payment, or posts for you, it shows
          up here.
        </p>
      ) : (
        <ul className="divide-y divide-subtle">
          {rows.map(row => {
            const status = STATUS_STYLES[row.status] ?? STATUS_STYLES.pending;
            return (
              <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg-primary">
                  {CAT_ACTIONS[row.action_id]?.name ?? row.action_id}
                </span>
                {row.amount_btc !== null && row.amount_btc > 0 && (
                  <span className="text-sm tabular-nums text-fg-secondary">
                    {formatAmountBtc(row.amount_btc)}
                  </span>
                )}
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${status.className}`}
                >
                  {status.label}
                </span>
                <span className="text-xs tabular-nums text-fg-tertiary">
                  {new Date(row.requested_at).toLocaleDateString(APP_LOCALE, {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                {row.status === 'failed' && row.error_message && (
                  <span className="w-full truncate text-xs text-status-negative">
                    {row.error_message}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

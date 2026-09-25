'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeAmountRaised } from '@/lib/projectGoal';
import Button from '@/components/ui/Button';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';

import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { Bitcoin } from 'lucide-react';
import { formatRelativeTime } from '@/utils/dates';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import { formatCurrency } from '@/services/currency';
import { API_ROUTES } from '@/config/api-routes';
import { DAY_FIRST_LOCALE } from '@/utils/locale';

/**
 * `target_completion` is `optionalText` in the schema, so the stored value is
 * whatever the form wrote — a date string, or "end of Q3", or anything else.
 * Format it as a date only when it genuinely parses, and otherwise show the
 * creator's own words instead of "Invalid Date". UTC is pinned deliberately: a
 * date formatted in the server's timezone shifts by a day for readers elsewhere.
 */
function formatTargetCompletion(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.trim();
  }
  return parsed.toLocaleDateString(DAY_FIRST_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

interface Props {
  project: {
    id: string;
    goal_amount: number | null;
    currency?: string | null;
    goal_currency?: string | null;
    bitcoin_address?: string | null;
    bitcoin_balance_btc?: number;
    bitcoin_balance_updated_at?: string | null;
    supporters_count?: number;
    last_support_at?: string | null;
    user_id?: string;
    /** Free text in the schema (`optionalText`), not a timestamp — render defensively. */
    target_completion?: string | null;
  };
  /** Honest settled-contributions total in BTC (get_entity_funding_stats). Drives
   *  "amount raised" — NOT the cached on-chain balance, which is Lightning-blind. */
  settledRaisedBtc?: number;
  isOwner?: boolean;
}

export default function ProjectSummaryRail({ project, settledRaisedBtc = 0, isOwner }: Props) {
  const { formatAmountBtc } = useDisplayCurrency();
  const goalCurrency = project.goal_currency || project.currency || PLATFORM_DEFAULT_CURRENCY;
  const targetCompletion = formatTargetCompletion(project.target_completion);
  // null = no Bitcoin rate available, so the goal currency can't be quoted.
  const [amountRaised, setAmountRaised] = useState<number | null>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [bitcoinBalanceBtc, setBitcoinBalanceBtc] = useState<number>(
    project.bitcoin_balance_btc || 0
  );
  const [bitcoinBalanceUpdatedAt, setBitcoinBalanceUpdatedAt] = useState<string | null>(
    project.bitcoin_balance_updated_at || null
  );

  // "Amount raised" comes from the settled-contributions ledger (includes
  // Lightning), converted to the goal currency — NOT the cached on-chain
  // balance below (which misses Lightning and can be stale). Refreshing the
  // balance updates the balance line only, never this figure.
  useEffect(() => {
    const init = async () => {
      const amt = await computeAmountRaised(settledRaisedBtc, goalCurrency);
      setAmountRaised(amt);
    };
    init();
  }, [settledRaisedBtc, goalCurrency]);

  const progress = useMemo(() => {
    const goal = project.goal_amount || 0;
    if (!goal || amountRaised === null) {
      return 0;
    }
    return Math.min((amountRaised / goal) * 100, 100);
  }, [amountRaised, project.goal_amount]);

  const onRefresh = useCallback(async () => {
    if (!project.bitcoin_address) {
      return;
    }
    setRefreshing(true);
    try {
      const res = await fetch(API_ROUTES.PROJECTS.REFRESH_BALANCE(project.id), { method: 'POST' });
      const body = await res.json();
      if (res.ok) {
        const payload = body?.data;
        if (payload?.balance_btc !== undefined) {
          setBitcoinBalanceBtc(payload.balance_btc);
          setBitcoinBalanceUpdatedAt(payload.updated_at || new Date().toISOString());
          toast.success('Balance refreshed successfully');
        }
      } else {
        const message = body?.error?.message || 'Failed to refresh balance';
        toast.error(message);
        logger.error(
          'Failed to refresh balance',
          { projectId: project.id, error: body?.error },
          'ProjectSummaryRail'
        );
      }
    } catch (error) {
      toast.error('Failed to refresh balance. Please try again.');
      logger.error(
        'Failed to refresh balance',
        { projectId: project.id, error },
        'ProjectSummaryRail'
      );
    } finally {
      setRefreshing(false);
    }
  }, [project.id, project.bitcoin_address]);

  return (
    <aside className="sticky top-20 rounded-lg border bg-surface-base dark:border-default p-6 space-y-4">
      <div>
        {/* No rate → quote the Bitcoin that actually arrived rather than claim
            "CHF 0 raised", which would be a false statement about the project. */}
        <div className="text-2xl font-bold">
          {amountRaised === null
            ? formatCurrency(settledRaisedBtc, 'BTC')
            : formatCurrency(amountRaised, goalCurrency)}
        </div>
        {project.goal_amount && amountRaised !== null && (
          <div className="text-sm text-fg-secondary">
            of {formatCurrency(project.goal_amount, goalCurrency)} goal
          </div>
        )}
        {project.bitcoin_address && (
          <div className="mt-3 p-3 bg-bitcoinOrange/5 rounded-lg border border-bitcoinOrange/20">
            <div className="flex items-center gap-2 mb-1">
              <Bitcoin className="w-4 h-4 text-bitcoinOrange" />
              <span className="text-xs font-medium text-bitcoinOrange uppercase tracking-wide">
                Bitcoin Balance
              </span>
            </div>
            {/* An unchecked balance is UNKNOWN, not zero — the rule #946 set
                for wallet cards, which this rail never followed. Until the
                column existed at all, `bitcoin_balance_btc` came back
                undefined and `|| 0` rendered a confident 0.00 for a project
                whose address nobody had ever read. `bitcoin_balance_updated_at`
                is the only honest witness that a chain lookup happened. */}
            <div
              className={`text-base font-semibold ${
                bitcoinBalanceUpdatedAt ? 'text-fg-primary' : 'text-fg-tertiary'
              }`}
            >
              {bitcoinBalanceUpdatedAt ? formatAmountBtc(bitcoinBalanceBtc) : '—'}
            </div>
            {!bitcoinBalanceUpdatedAt && (
              <div className="text-xs text-fg-secondary mt-1">Not checked yet</div>
            )}
            {bitcoinBalanceUpdatedAt && (
              <div className="text-xs text-fg-secondary mt-1">
                Updated {formatRelativeTime(bitcoinBalanceUpdatedAt)}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="w-full bg-surface-raised rounded-full h-3">
        <div className="bg-fg-primary h-3 rounded-full" style={{ width: `${progress}%` }} />
      </div>

      {/* When the creator says it will be done. The project form has collected
          this since the entity existed and no surface showed it, so backers
          funding a milestone-accountability entity could not see the milestone.
          Stored as free text, so a value that does not parse is shown verbatim
          rather than rendered as "Invalid Date". Fixed to UTC — this can render
          on the server, which cannot know the reader's timezone. */}
      {targetCompletion && (
        <div className="space-y-2 text-sm border-t pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-fg-secondary">Target completion</span>
            <span className="font-semibold text-fg-primary text-right break-words">
              {targetCompletion}
            </span>
          </div>
        </div>
      )}

      {/* Social Proof - Supporters Count */}
      {(project.supporters_count || project.last_support_at) && (
        <div className="space-y-2 text-sm border-t pt-4">
          {project.supporters_count !== undefined && project.supporters_count > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-fg-secondary">Supporters</span>
              <span className="font-semibold text-fg-primary">
                {project.supporters_count} {project.supporters_count === 1 ? 'person' : 'people'}
              </span>
            </div>
          )}
          {project.last_support_at && (
            <div className="text-xs text-status-positive flex items-center gap-1">
              <span className="w-2 h-2 bg-status-positive rounded-full animate-pulse" />
              Last contribution {formatRelativeTime(project.last_support_at)}
            </div>
          )}
        </div>
      )}

      {/* Owner Actions */}
      {isOwner && project.bitcoin_address && (
        <Button onClick={onRefresh} disabled={refreshing} variant="outline" className="w-full">
          {refreshing ? 'Refreshing…' : 'Refresh Balance'}
        </Button>
      )}
    </aside>
  );
}

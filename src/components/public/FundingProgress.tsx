/**
 * FundingProgress — the single funding-progress module for every funding entity.
 *
 * Replaces five near-identical, drifting copies (cause / research / investment /
 * wishlist, plus the project rail's display half). One component → one visual
 * language, one currency formatter, one zero-state.
 *
 * Two ground truths drove the design:
 *   - SSOT: raised/goal/progress was reimplemented per entity and formatted
 *     three different ways (formatCurrency vs displayBTC). Here it's formatted
 *     once, in the entity's own stored currency.
 *   - Serve humans: every prior copy returned `null` when no goal was set, so a
 *     fund page with no goal rendered *blank* (the cause bug). This always
 *     renders an inviting state — a fund page should never look empty.
 *
 * Server component: no hooks, pure presentation. Render it from a config's
 * `renderDetails` in PublicEntityDetailPage.
 */

import { formatCurrency } from '@/services/currency';
import { formatRelativeTime } from '@/utils/dates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Progress } from '@/components/ui/progress';

export interface FundingProgressProps {
  /** Amount raised so far, in `currency` units. */
  raised?: number | null;
  /** Funding goal, in `currency` units. 0/null → no goal set. */
  goal?: number | null;
  /** Currency the amounts are stored in (e.g. 'BTC', 'CHF'). Default 'BTC'. */
  currency?: string;
  /** Card title. Default 'Funding Progress'. */
  title?: string;
  /** Noun after the raised amount. Default 'raised' (wishlist uses 'funded'). */
  raisedLabel?: string;
  /** Noun after the goal amount. Default 'goal' (wishlist uses 'total'). */
  goalLabel?: string;
  /** Number of distinct backers, when the entity tracks it. */
  supportersCount?: number | null;
  /** ISO timestamp of the most recent contribution, when tracked. */
  lastSupportAt?: string | null;
  /**
   * When true and there is no goal, nothing raised, and no supporters, render
   * nothing. Use for surfaces where an empty funding card is noise (e.g. a
   * wishlist whose items carry no price). Default false — always invite.
   */
  hideWhenEmpty?: boolean;
}

export default function FundingProgress({
  raised,
  goal,
  currency = 'BTC',
  title = 'Funding Progress',
  raisedLabel = 'raised',
  goalLabel = 'goal',
  supportersCount,
  lastSupportAt,
  hideWhenEmpty = false,
}: FundingProgressProps) {
  const raisedAmt = Number(raised ?? 0);
  const goalAmt = Number(goal ?? 0);
  const hasGoal = goalAmt > 0;
  const hasRaised = raisedAmt > 0;
  const hasSupporters = (supportersCount ?? 0) > 0 || Boolean(lastSupportAt);

  if (hideWhenEmpty && !hasGoal && !hasRaised && !hasSupporters) {
    return null;
  }

  const progress = hasGoal ? Math.min(Math.round((raisedAmt / goalAmt) * 100), 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasGoal ? (
          <>
            <div className="flex justify-between items-center">
              <span className="text-sm text-fg-secondary">
                {formatCurrency(raisedAmt, currency)} {raisedLabel}
              </span>
              <span className="font-bold text-lg text-fg-primary">
                {formatCurrency(goalAmt, currency)} {goalLabel}
              </span>
            </div>
            <Progress value={progress} aria-label="Funding progress" className="h-2" />
            <p className="text-sm text-fg-secondary">
              {progress}% funded
              {!hasRaised && <span className="text-fg-tertiary"> · Be the first to back this</span>}
            </p>
          </>
        ) : hasRaised ? (
          // No goal, but money has come in — show momentum without a fake bar.
          <div className="space-y-1">
            <p className="text-2xl font-bold text-fg-primary">
              {formatCurrency(raisedAmt, currency)}
            </p>
            <p className="text-sm text-fg-secondary">
              {raisedLabel} so far · no goal set, every contribution helps
            </p>
          </div>
        ) : (
          // No goal, nothing raised — invite the first backer rather than render blank.
          <div className="space-y-1">
            <p className="text-base font-semibold text-fg-primary">Be the first to back this</p>
            <p className="text-sm text-fg-secondary">
              Contributions in Bitcoin go straight to the creator.
            </p>
          </div>
        )}

        {hasSupporters && (
          <div className="space-y-2 border-t border-subtle pt-4 text-sm">
            {(supportersCount ?? 0) > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-fg-secondary">Supporters</span>
                <span className="font-semibold text-fg-primary">
                  {supportersCount} {supportersCount === 1 ? 'person' : 'people'}
                </span>
              </div>
            )}
            {lastSupportAt && (
              <div className="flex items-center gap-1 text-xs text-status-positive">
                <span className="h-2 w-2 rounded-full bg-status-positive animate-pulse" />
                Last contribution {formatRelativeTime(lastSupportAt)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

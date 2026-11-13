import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import type { WalletGoalProgress } from '@/lib/wallet-goal';

/**
 * Goal progress on a wallet card. Both sides of the "saved / target" pair are
 * shown in the goal's own currency; a bar and a percentage appear only when
 * the balance could actually be converted into it.
 */
export function WalletGoalSection({ goal }: { goal: WalletGoalProgress }) {
  const { formatPrice } = useDisplayCurrency();

  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-fg-secondary font-medium">Goal</span>
        <span className="font-semibold text-fg-primary">
          {goal.balanceInGoalCurrency === null
            ? formatPrice(goal.goalAmount, goal.currency)
            : `${formatPrice(goal.balanceInGoalCurrency, goal.currency)} / ${formatPrice(goal.goalAmount, goal.currency)}`}
        </span>
      </div>
      {goal.percent === null ? (
        <div className="text-xs text-fg-secondary">
          Progress needs a {goal.currency} rate, which isn’t available right now.
        </div>
      ) : (
        <>
          <div className="w-full bg-surface-raised rounded-full h-2.5 mb-1">
            <div
              className="bg-fg-primary h-2.5 rounded-full transition-all"
              style={{ width: `${Math.min(goal.percent, 100)}%` }}
            />
          </div>
          <div className="text-xs text-fg-secondary">{goal.percent.toFixed(1)}% funded</div>
        </>
      )}
    </div>
  );
}

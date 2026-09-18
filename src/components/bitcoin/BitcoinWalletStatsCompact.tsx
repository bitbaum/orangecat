'use client';

import { logger } from '@/utils/logger';
import { useEffect, useState } from 'react';
import { Bitcoin, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import {
  getAddressBalance,
  getAddressTransactions,
  processTransactions,
  type TransactionSummary,
} from '@/services/mempool';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import Button from '@/components/ui/Button';
import { GRADIENTS } from '@/config/gradients';
import { FormattedDate } from '@/components/ui/FormattedDate';

interface BitcoinWalletStatsCompactProps {
  address: string;
  className?: string;
}

export default function BitcoinWalletStatsCompact({
  address,
  className = '',
}: BitcoinWalletStatsCompactProps) {
  const { formatSats } = useDisplayCurrency();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [balanceResult, txsResult] = await Promise.all([
        getAddressBalance(address),
        getAddressTransactions(address, 5),
      ]);

      setBalance(balanceResult);

      if (txsResult.length > 0) {
        const processed = processTransactions(txsResult, address);
        setTransactions(processed);
      }
    } catch (err) {
      setError('Failed to load wallet data');
      logger.error('Error fetching wallet data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (address) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  if (loading) {
    return (
      <div className={`bg-surface-base rounded-lg p-4 border border-default ${className}`}>
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="w-5 h-5 animate-spin text-bitcoinOrange" />
        </div>
      </div>
    );
  }

  if (error || balance === null) {
    return (
      <div className={`bg-surface-base rounded-lg p-4 border border-default ${className}`}>
        <div className="text-center text-fg-secondary py-2">
          <p className="text-sm mb-2">Unable to load wallet data</p>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const totalReceived = transactions
    .filter(tx => tx.type === 'received')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const hasTransactions = transactions.length > 0;

  return (
    <div
      className={`bg-surface-base rounded-lg border border-default overflow-hidden ${className}`}
    >
      {/* Balance Display */}
      <div className={`${GRADIENTS.brandOrangeAmber} p-4 text-white`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Bitcoin className="w-4 h-4" />
            <span className="text-xs font-medium">Balance</span>
          </div>
          <button
            onClick={fetchData}
            className="text-white/80 hover:text-white transition-colors p-1 min-h-11 min-w-11 flex items-center justify-center"
            aria-label="Refresh balance"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        <div className="text-xl font-bold">{formatSats(balance)}</div>
        {totalReceived > 0 && (
          <div className="text-xs opacity-80 mt-0.5">
            Total received: {formatSats(totalReceived)}
          </div>
        )}
      </div>

      {/* Transaction Summary */}
      {hasTransactions ? (
        <div className="p-4">
          <h4 className="text-xs font-semibold text-fg-primary mb-3 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Recent Activity
          </h4>

          <div className="space-y-2">
            {transactions.slice(0, 3).map(tx => (
              <div
                key={tx.txid}
                className="flex items-center justify-between text-sm p-2 bg-surface-raised rounded"
              >
                <div className="flex items-center gap-2">
                  {tx.type === 'received' ? (
                    <TrendingDown className="w-3 h-3 text-status-positive" />
                  ) : (
                    <TrendingUp className="w-3 h-3 text-status-negative" />
                  )}
                  <span
                    className={`font-medium text-xs ${
                      tx.type === 'received' ? 'text-status-positive' : 'text-status-negative'
                    }`}
                  >
                    {tx.type === 'received' ? '+' : '-'}
                    {formatSats(tx.amount)}
                  </span>
                  {!tx.confirmed && (
                    <span className="text-xs bg-status-warning-subtle text-status-warning px-1.5 py-0.5 rounded">
                      Pending
                    </span>
                  )}
                </div>
                <div className="text-xs text-fg-secondary">
                  {tx.timestamp ? (
                    <FormattedDate value={new Date(tx.timestamp * 1000)} />
                  ) : (
                    'Unconfirmed'
                  )}
                </div>
              </div>
            ))}
          </div>

          {transactions.length > 3 && (
            <div className="mt-3 text-center">
              <span className="text-xs text-fg-secondary">
                +{transactions.length - 3} more transactions
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 text-center text-fg-secondary">
          <p className="text-xs">No transactions yet</p>
        </div>
      )}
    </div>
  );
}

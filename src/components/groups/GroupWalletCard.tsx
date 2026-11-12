'use client';

/**
 * One group wallet row — addresses, balance, refresh. Extracted from
 * GroupWallets.tsx to keep that component under 300 lines. Owns its own
 * balance-refresh state; calls back to the parent to re-fetch the list.
 */
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import type { GroupWalletSummary } from '@/services/groups/types';
import { toast } from 'sonner';
import { API_ROUTES } from '@/config/api-routes';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { BADGE_COLORS } from '@/config/badge-colors';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import { explorerAddressUrl } from '@/lib/bitcoin/explorer';
import { FormattedDate } from '@/components/ui/FormattedDate';

export function GroupWalletCard({
  wallet,
  groupSlug,
  canRefresh,
  onUpdate,
}: {
  wallet: GroupWalletSummary;
  groupSlug: string;
  /**
   * Founder or admin. The stored balance changes only under the
   * group_wallets_update policy (those two roles); anyone else's refresh read
   * the chain and stored nothing.
   */
  canRefresh: boolean;
  onUpdate?: () => void;
}) {
  const { formatAmountBtc } = useDisplayCurrency();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshBalance = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(API_ROUTES.GROUPS.WALLET_REFRESH(groupSlug, wallet.id), {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(apiErrorMessage(error, 'Failed to refresh balance'));
      }
      const data = await response.json();
      toast.success(`Balance updated: ${formatAmountBtc(data.data?.balance || 0)}`);
      onUpdate?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to refresh balance');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address).then(
      () => toast.success('Address copied to clipboard'),
      () => toast.error('Could not copy — select the address and copy it by hand')
    );
  };

  return (
    <Card className="border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{wallet.name}</CardTitle>
          {wallet.is_active ? (
            <Badge variant="default" className={BADGE_COLORS.success}>
              Active
            </Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          )}
        </div>
        {wallet.description && <CardDescription>{wallet.description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        {wallet.purpose && (
          <div className="text-sm">
            <span className="text-fg-secondary">Purpose: </span>
            <span className="font-medium capitalize">{wallet.purpose}</span>
          </div>
        )}

        {wallet.bitcoin_address && (
          <div className="space-y-1">
            <div className="text-sm text-fg-secondary">Bitcoin Address</div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded bg-surface-raised p-2 font-mono text-xs">
                {wallet.bitcoin_address}
              </code>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Copy Bitcoin address"
                onClick={() => handleCopyAddress(wallet.bitcoin_address!)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label="View address on a block explorer"
                onClick={() =>
                  window.open(explorerAddressUrl(wallet.bitcoin_address!), '_blank', 'noopener')
                }
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {wallet.lightning_address && (
          <div className="space-y-1">
            <div className="text-sm text-fg-secondary">Lightning Address</div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded bg-surface-raised p-2 font-mono text-xs">
                {wallet.lightning_address}
              </code>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Copy Lightning address"
                onClick={() => handleCopyAddress(wallet.lightning_address!)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {(wallet.bitcoin_address || wallet.required_signatures > 1) && (
          <div className="flex items-center justify-between pt-2 border-t">
            {/* Balance — the personal wallet's rule (WalletCard): only an
                on-chain address has a balance anyone can read, so a
                Lightning-only wallet shows none; and a balance nobody has read
                is unknown, not zero. current_balance_btc defaults to 0, so
                without balance_updated_at that 0 says nothing. */}
            {wallet.bitcoin_address && (
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div>
                    <div className="text-sm text-fg-secondary">Balance</div>
                    {/* Green only for a non-zero balance — a zero
                        rendered green reads as a positive it isn't. */}
                    <div
                      className={`text-lg font-bold ${
                        !wallet.balance_updated_at
                          ? 'text-fg-tertiary'
                          : Number(wallet.current_balance_btc) > 0
                            ? 'text-status-positive'
                            : 'text-fg-primary'
                      }`}
                    >
                      {wallet.balance_updated_at
                        ? formatAmountBtc(wallet.current_balance_btc)
                        : '—'}
                    </div>
                    <div className="text-xs text-fg-secondary">
                      {wallet.balance_updated_at ? (
                        <>
                          Updated{' '}
                          <FormattedDate value={wallet.balance_updated_at} mode="datetime" />
                        </>
                      ) : canRefresh ? (
                        'Not checked yet — refresh to read it from the blockchain'
                      ) : (
                        'Not checked yet'
                      )}
                    </div>
                  </div>
                  {canRefresh && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleRefreshBalance}
                      disabled={refreshing}
                      aria-label="Refresh balance"
                      className="ml-auto"
                    >
                      {refreshing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
            {wallet.required_signatures > 1 && (
              <div className="text-sm text-fg-secondary">
                Multi-sig: {wallet.required_signatures} signatures required
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

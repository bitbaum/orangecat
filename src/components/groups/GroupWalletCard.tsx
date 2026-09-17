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

export function GroupWalletCard({
  wallet,
  groupSlug,
  onUpdate,
}: {
  wallet: GroupWalletSummary;
  groupSlug: string;
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
    navigator.clipboard.writeText(address);
    toast.success('Address copied to clipboard');
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
              <code className="flex-1 font-mono text-xs break-all text-sm bg-surface-raised p-2 rounded">
                {wallet.bitcoin_address}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopyAddress(wallet.bitcoin_address!)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  window.open(
                    `https://blockstream.info/address/${wallet.bitcoin_address}`,
                    '_blank'
                  )
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
              <code className="flex-1 font-mono text-xs bg-surface-raised p-2 rounded">
                {wallet.lightning_address}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopyAddress(wallet.lightning_address!)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div>
                <div className="text-sm text-fg-secondary">Balance</div>
                {/* Green only for a non-zero balance — a zero
                    rendered green reads as a positive it isn't. */}
                <div
                  className={`text-lg font-bold ${
                    Number(wallet.current_balance_btc) > 0
                      ? 'text-status-positive'
                      : 'text-fg-primary'
                  }`}
                >
                  {formatAmountBtc(wallet.current_balance_btc)}
                </div>
              </div>
              {wallet.bitcoin_address && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRefreshBalance}
                  disabled={refreshing}
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
          {wallet.required_signatures > 1 && (
            <div className="text-sm text-fg-secondary">
              Multi-sig: {wallet.required_signatures} signatures required
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

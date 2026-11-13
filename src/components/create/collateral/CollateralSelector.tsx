'use client';

import { Shield, Wallet, Package, CheckCircle2, AlertCircle } from 'lucide-react';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/config/routes';
import { useCollateralSelector } from './useCollateralSelector';
import { CollateralItemPicker } from './CollateralItemPicker';
import { BADGE_COLORS } from '@/config/badge-colors';

export interface CollateralItem {
  id: string;
  type: 'asset' | 'wallet';
  name: string;
  value: number;
  currency: string;
  metadata?: {
    verification_status?: string;
    balance_btc?: number;
  };
}

interface CollateralSelectorProps {
  selectedCollateral: CollateralItem[];
  onCollateralChange: (items: CollateralItem[]) => void;
  loanAmount?: number;
  loanCurrency?: string;
  disabled?: boolean;
}

export function CollateralSelector({
  selectedCollateral,
  onCollateralChange,
  loanAmount,
  loanCurrency = PLATFORM_DEFAULT_CURRENCY,
  disabled = false,
}: CollateralSelectorProps) {
  const { profile } = useAuth();
  const { formatAmountBtc, formatPrice } = useDisplayCurrency();

  const {
    assets,
    wallets,
    loading,
    showAssetSelector,
    showWalletSelector,
    totalCollateral,
    coveragePercentage,
    handleAddAsset,
    handleAddWallet,
    handleRemoveCollateral,
    toggleAssetSelector,
    toggleWalletSelector,
  } = useCollateralSelector({
    profileId: profile?.id,
    selectedCollateral,
    onCollateralChange,
    loanAmount,
  });

  const assetPickerItems = assets
    .filter(a => !selectedCollateral.some(c => c.id === a.id && c.type === 'asset'))
    .map(a => ({
      id: a.id,
      label: a.title,
      sublabel: a.estimated_value
        ? formatPrice(a.estimated_value, a.currency || PLATFORM_DEFAULT_CURRENCY)
        : undefined,
    }));

  const walletPickerItems = wallets
    .filter(w => !selectedCollateral.some(c => c.id === w.id && c.type === 'wallet'))
    .map(w => ({
      id: w.id,
      label: w.label,
      sublabel: w.balance_btc ? formatAmountBtc(w.balance_btc) : undefined,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Collateral (Optional)
        </CardTitle>
        <CardDescription>
          Add assets or wallets as collateral to potentially improve loan terms. Higher collateral
          value may result in better interest rates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedCollateral.length > 0 && (
          <div className="bg-surface-raised border border-subtle rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-fg-primary">Total Collateral Value</span>
              <span className="text-lg font-bold text-fg-primary">
                {formatPrice(totalCollateral, loanCurrency)}
              </span>
            </div>
            {loanAmount && coveragePercentage !== null && (
              <>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 bg-surface-raised rounded-full h-2">
                    <div
                      className={cn(
                        'h-2 rounded-full transition-all',
                        coveragePercentage >= 100
                          ? 'bg-status-positive'
                          : coveragePercentage >= 50
                            ? 'bg-status-warning'
                            : 'bg-status-negative'
                      )}
                      style={{ width: `${Math.min(100, coveragePercentage)}%` }}
                    />
                  </div>
                  <span className="text-xs text-fg-secondary font-medium">
                    {coveragePercentage.toFixed(0)}% coverage
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs">
                  {coveragePercentage >= 100 ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-status-positive" />
                      <span className="text-status-positive">
                        Collateral fully covers loan amount
                      </span>
                    </>
                  ) : coveragePercentage >= 50 ? (
                    <>
                      <AlertCircle className="w-3 h-3 text-status-warning" />
                      <span className="text-status-warning">Partial collateral coverage</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3 text-status-warning" />
                      <span className="text-status-warning">Low collateral coverage</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {selectedCollateral.length > 0 && (
          <div className="space-y-2">
            {selectedCollateral.map(item => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center justify-between p-3 bg-surface-raised/50 rounded-lg border border-default"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      'h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center',
                      item.type === 'asset' ? BADGE_COLORS.info : BADGE_COLORS.tiffany
                    )}
                  >
                    {item.type === 'asset' ? (
                      <Package className="w-4 h-4" />
                    ) : (
                      <Wallet className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-fg-primary">
                        {item.name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {item.type === 'asset' ? 'Asset' : 'Wallet'}
                      </Badge>
                    </div>
                    <span className="text-xs text-fg-secondary">
                      {formatPrice(item.value, item.currency)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveCollateral(item.id)}
                  disabled={disabled}
                  className="text-status-negative hover:text-status-negative/80"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={toggleAssetSelector}
            disabled={disabled || loading}
            className="flex-1"
          >
            <Package className="w-4 h-4" />
            Add Asset
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={toggleWalletSelector}
            disabled={disabled || loading}
            className="flex-1"
          >
            <Wallet className="w-4 h-4" />
            Add Wallet
          </Button>
        </div>

        {showAssetSelector && (
          <CollateralItemPicker
            title="Select Asset"
            loading={loading}
            items={assetPickerItems}
            emptyMessage="No assets available"
            emptyLinkHref={ROUTES.DASHBOARD.ASSETS_CREATE}
            emptyLinkText="Create an asset"
            onSelect={item => handleAddAsset(assets.find(a => a.id === item.id)!)}
          />
        )}

        {showWalletSelector && (
          <CollateralItemPicker
            title="Select Wallet"
            loading={loading}
            items={walletPickerItems}
            emptyMessage="No wallets available"
            emptyLinkHref={ROUTES.DASHBOARD.WALLETS_CREATE}
            emptyLinkText="Create a wallet"
            onSelect={item => handleAddWallet(wallets.find(w => w.id === item.id)!)}
          />
        )}
      </CardContent>
    </Card>
  );
}

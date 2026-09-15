'use client';

import Link from 'next/link';
import { Bitcoin, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { truncateAddress } from '@/utils/string';
import Button from '@/components/ui/Button';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';

import { QRCodeSVG } from 'qrcode.react';
import { Wallet, WALLET_CATEGORIES } from '@/types/wallet';
import BitcoinDonationCard from '@/components/bitcoin/BitcoinDonationCard';
import BitcoinWalletStatsCompact from '@/components/bitcoin/BitcoinWalletStatsCompact';
import { WalletsSkeleton } from '@/components/profile/ProfileSkeleton';
import { getWalletReceiveHandle } from '@/lib/wallet-receive-handle';
import { ROUTES } from '@/config/routes';
import { computeWalletGoalProgress } from '@/lib/wallet-goal';
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';

interface ProfileWalletSectionProps {
  wallets: Wallet[];
  loading: boolean;
  isOwnProfile: boolean;
  legacyBitcoinAddress?: string | null;
  legacyLightningAddress?: string | null;
  legacyBalance?: number | null;
  onEditClick?: () => void;
}

/**
 * ProfileWalletSection Component
 *
 * Displays wallet cards for accepting Bitcoin funding.
 * Supports both new multi-wallet system and legacy single address.
 */
export default function ProfileWalletSection({
  wallets,
  loading,
  isOwnProfile,
  legacyBitcoinAddress,
  legacyLightningAddress,
  legacyBalance,
  onEditClick,
}: ProfileWalletSectionProps) {
  const { formatAmountBtc, formatPrice } = useDisplayCurrency();
  const { convertFromBTC } = useCurrencyConversion();

  // Show loading skeleton
  if (loading) {
    return <WalletsSkeleton />;
  }

  // Show new multi-wallet system if wallets exist
  if (wallets.length > 0) {
    return (
      <div className="space-y-4" data-wallet-section>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bitcoin className="w-5 h-5 text-bitcoinOrange" />
          Support This Profile
        </h3>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* No `.filter(w => w.is_active)` here, deliberately. GET /api/wallets
              already applies `.eq('is_active', true)` server-side for both the
              owner and the public path, and `is_active` is NOT one of the
              PUBLIC_WALLET_FIELDS — so for a visitor the filter tested
              `undefined` and dropped every wallet. This section rendered its
              heading and no cards at all. */}
          {wallets
            .map(wallet => {
              const categoryInfo = WALLET_CATEGORIES[wallet.category];
              // Balance is BTC, the goal is in goal_currency — see
              // lib/wallet-goal.ts for why dividing them directly is wrong.
              const goal = computeWalletGoalProgress(
                {
                  balanceBtc: wallet.balance_btc,
                  goalAmount: wallet.goal_amount,
                  goalCurrency: wallet.goal_currency,
                },
                convertFromBTC
              );
              const handle = getWalletReceiveHandle(wallet);

              return (
                <div key={wallet.id} className="oc-surface p-6 oc-card-link">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-3xl">{wallet.category_icon || categoryInfo.icon}</span>
                    <div className="flex-1">
                      <h4 className="font-semibold flex items-center gap-2">
                        {/* The wallet's own page. A wallet is the thing a
                            supporter is actually asked to fund, and until this
                            route existed there was nothing to send them —
                            only a card inside somebody's profile tab. */}
                        <Link
                          href={ROUTES.WALLETS.VIEW(wallet.id)}
                          className="hover:text-bitcoinOrange transition-colors"
                        >
                          {wallet.label}
                        </Link>
                        {wallet.is_primary && (
                          <span className="text-xs bg-bitcoinOrange/10 text-bitcoinOrange border border-bitcoinOrange/30 px-2 py-0.5 rounded">
                            Primary
                          </span>
                        )}
                      </h4>
                      {wallet.description && (
                        <p className="text-sm text-fg-secondary mt-1">{wallet.description}</p>
                      )}
                      <p className="text-xs text-fg-secondary mt-1">{categoryInfo.label}</p>
                    </div>
                  </div>

                  {/* Balance — read from the chain against the wallet's address,
                      so it means nothing for a Lightning wallet. The second
                      condition matters as much as the first: `balance_btc` is
                      not among PUBLIC_WALLET_FIELDS, so on a visitor's request
                      it is absent, and formatting it produced the literal
                      string "₿NaN" on a public page. A balance we did not fetch
                      is not a balance of zero — show nothing. */}
                  {handle.kind === 'onchain' && typeof wallet.balance_btc === 'number' && (
                    <div className="bg-surface-raised rounded-lg p-3 mb-3">
                      <div className="text-sm text-fg-secondary mb-1">Current Balance</div>
                      <div className="text-xl font-bold text-bitcoinOrange">
                        {formatAmountBtc(wallet.balance_btc)}
                      </div>
                    </div>
                  )}

                  {/* Goal progress — tracked from the on-chain balance. Both
                      amounts in the goal's own currency; bar only when the
                      balance could be converted into it. */}
                  {handle.kind === 'onchain' && goal && (
                    <div className="mb-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-fg-secondary">Goal</span>
                        <span className="font-medium">
                          {goal.balanceInGoalCurrency === null
                            ? formatPrice(goal.goalAmount, goal.currency)
                            : `${formatPrice(goal.balanceInGoalCurrency, goal.currency)} / ${formatPrice(goal.goalAmount, goal.currency)}`}
                        </span>
                      </div>
                      {goal.percent === null ? (
                        <div className="text-xs text-fg-secondary mt-1">
                          Progress needs a {goal.currency} rate, which isn’t available right now.
                        </div>
                      ) : (
                        <>
                          <div className="w-full bg-surface-raised rounded-full h-2">
                            <div
                              className="bg-bitcoinOrange h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(goal.percent, 100)}%` }}
                            />
                          </div>
                          <div className="text-xs text-fg-secondary mt-1">
                            {goal.percent.toFixed(1)}% funded
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* QR — only when there is something scannable (a Lightning
                      or connection wallet has no bitcoin: URI). */}
                  {handle.qrValue && (
                    <div className="mb-4 flex justify-center">
                      <div className="bg-surface-base p-3 rounded-lg border-2 border-default shadow-sm">
                        <QRCodeSVG
                          value={handle.qrValue}
                          size={120}
                          level="H"
                          includeMargin={false}
                        />
                      </div>
                    </div>
                  )}

                  {/* Public receive handle — whatever rail this wallet uses */}
                  <div className="pt-3 border-t">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-fg-secondary">{handle.label}</span>
                      {handle.value && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(handle.value as string);
                            toast.success('Copied to clipboard');
                          }}
                          className="text-xs text-fg-primary hover:text-fg-primary font-medium"
                          aria-label={`Copy ${handle.label}`}
                        >
                          <Copy className="w-3 h-3 inline mr-1" />
                          Copy
                        </button>
                      )}
                    </div>
                    <code
                      className="text-xs text-fg-primary block font-mono break-all bg-surface-raised p-2 rounded cursor-pointer hover:bg-surface-raised/80 transition-colors"
                      onClick={() => {
                        if (handle.value) {
                          navigator.clipboard.writeText(handle.value);
                          toast.success('Copied to clipboard');
                        }
                      }}
                      title={handle.value ? 'Click to copy' : undefined}
                    >
                      {handle.kind === 'onchain' && handle.value
                        ? truncateAddress(handle.value, 20, 10)
                        : (handle.value ?? handle.emptyText)}
                    </code>
                  </div>

                  {/* Send Button — needs a payable URI. An xpub or a wallet
                      connection has none, and `bitcoin:null` opened nothing. */}
                  {handle.qrValue && (
                    <div className="mt-3 pt-3 border-t">
                      <Button
                        onClick={() => {
                          window.location.href = handle.qrValue as string;
                          // Fallback: show toast if wallet doesn't open
                          setTimeout(() => {
                            toast.info(
                              "If your wallet didn't open, copy the address and paste it manually"
                            );
                          }, 500);
                        }}
                        className="w-full bg-bitcoinOrange hover:bg-bitcoinOrange/90 text-white"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Send with Wallet
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    );
  }

  // Show empty state for own profile
  if (wallets.length === 0 && isOwnProfile) {
    return (
      <div className="oc-surface p-6">
        <div className="text-center text-fg-secondary py-8">
          <Bitcoin className="w-12 h-12 mx-auto mb-3 text-fg-tertiary dark:text-fg-secondary" />
          <h3 className="text-lg font-semibold text-fg-primary mb-2">Accept Bitcoin Funding</h3>
          <p className="text-sm mb-4">
            Add Bitcoin wallets to start receiving funding from supporters
          </p>
          {onEditClick && (
            <Button variant="outline" onClick={onEditClick}>
              <Bitcoin className="w-4 h-4 mr-2" />
              Add Wallets
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Show legacy Bitcoin address if no new wallets but has legacy addresses
  if (wallets.length === 0 && (legacyBitcoinAddress || legacyLightningAddress)) {
    return (
      <div className="space-y-4">
        <BitcoinDonationCard
          bitcoinAddress={legacyBitcoinAddress || undefined}
          lightningAddress={legacyLightningAddress || undefined}
          balance={legacyBalance || undefined}
        />
        {legacyBitcoinAddress && <BitcoinWalletStatsCompact address={legacyBitcoinAddress} />}
      </div>
    );
  }

  // No wallets and not own profile - show nothing
  return (
    <div className="oc-surface p-6 text-center text-fg-secondary">
      <Bitcoin className="w-10 h-10 mx-auto mb-3 text-fg-tertiary dark:text-fg-secondary" />
      <h3 className="text-lg font-semibold text-fg-primary mb-1">No wallets shared yet</h3>
      <p className="text-sm text-fg-secondary">
        This profile has not added any wallets you can send to yet.
      </p>
    </div>
  );
}

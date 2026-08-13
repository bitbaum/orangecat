'use client';

import { useState } from 'react';
import { Bitcoin, Heart, Copy, ShieldCheck, ExternalLink } from 'lucide-react';
import BitcoinPaymentButton from '@/components/bitcoin/BitcoinPaymentButton';
import Button from '@/components/ui/Button';
import { QRCodeSVG } from 'qrcode.react';
import { WishlistDonationTiers } from '@/components/wishlist/WishlistDonationTiers';
import { convert, formatCurrency, displayBTC } from '@/services/currency';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { useProjectDonation } from './useProjectDonation';
import { ROUTES } from '@/config/routes';
import { LABELED_SUPPORT_AMOUNTS_BTC } from '@/config/payment-presets';
import { authLoginPath } from '@/lib/navigation/safe-return-path';

interface ProjectDonationSectionProps {
  projectId: string;
  ownerId?: string;
  bitcoinAddress: string | null;
  projectTitle?: string;
  isOwner?: boolean;
}

export function ProjectDonationSection({
  projectId,
  ownerId,
  bitcoinAddress,
  projectTitle = ENTITY_REGISTRY.project.name,
  isOwner = false,
}: ProjectDonationSectionProps) {
  const {
    user,
    userCurrency,
    isFavorited,
    isTogglingFavorite,
    handleToggleFavorite,
    copyToClipboard,
  } = useProjectDonation(projectId);

  // Selected suggested amount (BTC) drives a BIP21 deep-link so the funder can
  // tap "Open in wallet" and their app opens with the address AND amount
  // prefilled — the mobile path (you can't scan your own screen). Null = no
  // amount chosen; the link still opens the wallet with just the address.
  const [selectedBtc, setSelectedBtc] = useState<number | null>(null);
  const paymentUri = bitcoinAddress
    ? `bitcoin:${bitcoinAddress}${
        selectedBtc ? `?amount=${selectedBtc}&label=${encodeURIComponent(projectTitle)}` : ''
      }`
    : '';

  return (
    <>
      <section className="border-t pt-6" aria-labelledby="support-heading">
        <h3 id="support-heading" className="text-lg font-semibold mb-4">
          Support this Project
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          {user ? (
            <Button
              onClick={handleToggleFavorite}
              disabled={isTogglingFavorite}
              variant={isFavorited ? 'primary' : 'outline'}
              className={`flex-1 flex items-center justify-center gap-2 ${
                isFavorited
                  ? 'bg-status-negative hover:bg-status-negative/90 text-fg-inverted border-status-negative'
                  : 'border-strong hover:border-status-negative/40 hover:text-status-negative'
              }`}
              aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isTogglingFavorite ? (
                <>
                  <div
                    className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  <span>{isFavorited ? 'Removing...' : 'Adding...'}</span>
                </>
              ) : (
                <>
                  <Heart
                    className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`}
                    aria-hidden="true"
                  />
                  <span>{isFavorited ? 'Favorited' : 'Add to Favorites'}</span>
                </>
              )}
            </Button>
          ) : (
            <Button
              href={authLoginPath(`${ROUTES.PROJECTS.VIEW(projectId)}?intent=favorite`)}
              variant="outline"
              className="flex-1 flex items-center justify-center gap-2 border-strong hover:border-status-negative/40 hover:text-status-negative"
              aria-label="Sign in to favorite this project"
            >
              <Heart className="w-4 h-4" aria-hidden="true" />
              <span>Sign in to Favorite</span>
            </Button>
          )}

          {bitcoinAddress && (
            <div className="flex-1">
              <div className="hidden sm:block">
                <BitcoinPaymentButton projectId={projectId} projectTitle={projectTitle} />
              </div>
              <div className="sm:hidden">
                <Button
                  onClick={() => {
                    const supportSection = document.getElementById('bitcoin-support-section');
                    if (supportSection) {
                      supportSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="w-full bg-bitcoinOrange hover:bg-bitcoinOrange/90 text-white"
                  aria-label="Scroll to Bitcoin funding section"
                >
                  <Bitcoin className="w-4 h-4 mr-2" aria-hidden="true" />
                  Fund with Bitcoin
                </Button>
              </div>
            </div>
          )}
        </div>
        <p className="text-sm text-fg-secondary mt-3">
          {user
            ? isFavorited
              ? 'You can find this project in your Favorites to support later.'
              : 'Save this project to your favorites to support later, or fund now.'
            : 'Sign in to save this project to your favorites and support later.'}
        </p>
      </section>

      {bitcoinAddress && (
        <section
          id="bitcoin-support-section"
          className="border-t pt-6"
          aria-labelledby="bitcoin-heading"
        >
          <h3 id="bitcoin-heading" className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Bitcoin className="w-5 h-5 text-bitcoinOrange" aria-hidden="true" />
            Fund with Bitcoin
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col items-center justify-center bg-surface-base p-6 rounded-lg border border-default">
              {/* Mobile-first: tapping opens the funder's default Bitcoin wallet
                  with the address (+ amount, if one is selected below) prefilled —
                  no copy/paste, and no scanning your own screen. */}
              <a
                href={paymentUri}
                className="mb-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-bitcoinOrange px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-bitcoinOrange/90"
              >
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
                Open in wallet{selectedBtc ? ` — send ${displayBTC(selectedBtc)}` : ''}
              </a>
              <div className="bg-surface-base p-3 rounded-lg shadow-sm">
                <QRCodeSVG
                  value={paymentUri}
                  size={180}
                  level="H"
                  includeMargin={true}
                  className="w-full h-auto"
                />
              </div>
              <p className="text-xs text-center text-fg-secondary mt-3">
                or scan with a Bitcoin wallet on another device
              </p>
            </div>

            <div className="flex flex-col justify-center">
              <div className="bg-surface-raised rounded-lg p-4 border border-default">
                <label className="text-xs font-medium text-fg-secondary mb-2 block uppercase tracking-wide">
                  Bitcoin Address
                </label>
                <div className="flex items-start gap-2">
                  <code className="text-sm font-mono text-fg-primary break-all flex-1 leading-relaxed">
                    {bitcoinAddress}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(bitcoinAddress, 'Bitcoin address')}
                    className="flex-shrink-0"
                    aria-label="Copy Bitcoin address to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 text-sm text-fg-secondary">
                <ShieldCheck className="w-4 h-4 text-status-positive" aria-hidden="true" />
                <span>Address verified and monitored</span>
              </div>
            </div>
          </div>

          {ownerId && !isOwner && (
            <div className="mt-6 border-t pt-6">
              <WishlistDonationTiers
                userId={ownerId}
                projectId={projectId}
                projectTitle={projectTitle}
              />
            </div>
          )}

          <div className="mt-6 border-t pt-6">
            <p className="text-sm font-medium text-fg-primary mb-3">
              {ownerId && !isOwner ? 'Other amounts:' : 'Suggested support amounts:'}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {LABELED_SUPPORT_AMOUNTS_BTC.map(({ btc, label }) => {
                const displayAmount = convert(btc, 'BTC', userCurrency);
                const formattedAmount = formatCurrency(displayAmount, userCurrency, {
                  compact: true,
                });
                const btcDisplay = displayBTC(btc);
                const isSelected = selectedBtc === btc;

                return (
                  <button
                    key={btc}
                    onClick={() => setSelectedBtc(isSelected ? null : btc)}
                    aria-pressed={isSelected}
                    className={`px-4 py-3 border-2 rounded-lg transition-all text-center group ${
                      isSelected
                        ? 'border-bitcoinOrange bg-bitcoinOrange/10'
                        : 'border-strong hover:border-bitcoinOrange hover:bg-bitcoinOrange/5'
                    }`}
                  >
                    <div
                      className={`font-semibold ${
                        isSelected
                          ? 'text-bitcoinOrange'
                          : 'text-fg-primary group-hover:text-bitcoinOrange'
                      }`}
                    >
                      {formattedAmount}
                    </div>
                    <div className="text-xs text-fg-tertiary mt-0.5">≈ {btcDisplay}</div>
                    <div className="text-xs text-fg-secondary mt-1">{label}</div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-fg-secondary mt-3 text-center">
              Pick an amount to prefill it in your wallet — or send any amount to the address above.
            </p>
          </div>
        </section>
      )}
    </>
  );
}

'use client';

import { ScanCode } from '@/components/ui/ScanCode';
import { Bitcoin, Zap, Copy, ExternalLink } from 'lucide-react';
import { GRADIENTS } from '@/config/gradients';
import Button from '@/components/ui/Button';
import { toast } from 'sonner';
import { useUserCurrency } from '@/hooks/useUserCurrency';
import { convert, formatCurrency } from '@/services/currency';

interface AddressCardProps {
  type: 'bitcoin' | 'lightning';
  address: string;
  label: string;
  description: string;
}

function AddressCard({ type, address, label, description }: AddressCardProps) {
  const Icon = type === 'bitcoin' ? Bitcoin : Zap;
  const isBitcoin = type === 'bitcoin';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(address);
    toast.success(`${label} address copied to clipboard`);
  };

  // Click address to copy (one click)
  const handleAddressClick = () => {
    copyToClipboard();
  };

  // Open wallet app directly (bitcoin: URI scheme)
  const openInWallet = () => {
    if (isBitcoin) {
      const bitcoinUri = `bitcoin:${address}`;
      window.location.href = bitcoinUri;
      // Fallback: show toast if wallet doesn't open
      setTimeout(() => {
        toast.info("If your wallet didn't open, copy the address and paste it manually");
      }, 500);
    } else {
      // Lightning: copy invoice
      copyToClipboard();
      toast.info('Lightning invoice copied. Paste it in your Lightning wallet');
    }
  };

  return (
    <div
      className={`bg-surface-base rounded-lg border-2 p-6 ${isBitcoin ? 'border-bitcoinOrange/30' : 'border-status-warning/30'}`}
      data-bitcoin-card={isBitcoin ? 'true' : undefined}
      data-lightning-card={!isBitcoin ? 'true' : undefined}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`w-5 h-5 ${isBitcoin ? 'text-bitcoinOrange' : 'text-status-warning'}`} />
        <div>
          <h4 className="font-semibold text-fg-primary text-sm">{label}</h4>
          <p className="text-xs text-fg-secondary">{description}</p>
        </div>
      </div>

      {/* QR Code - Always Visible */}
      <div className="flex justify-center mb-4">
        <div className="bg-surface-base p-3 rounded-lg border-2 border-default shadow-sm">
          <ScanCode value={isBitcoin ? `bitcoin:${address}` : address} size={200} />
        </div>
      </div>

      {/* Address - Clickable to Copy */}
      <div
        className="bg-surface-raised rounded-lg p-3 mb-3 cursor-pointer hover:bg-surface-raised/80 transition-colors border border-default"
        onClick={handleAddressClick}
        title="Click to copy address"
      >
        <code className="text-xs font-mono text-fg-primary break-all select-all">{address}</code>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        {/* Primary: Open in Wallet (one click) */}
        {isBitcoin && (
          <Button
            onClick={openInWallet}
            className="w-full bg-bitcoinOrange hover:bg-bitcoinOrange/90 text-white"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Send with Wallet
          </Button>
        )}

        {/* Secondary: Copy Address */}
        <Button
          variant="outline"
          size="sm"
          onClick={copyToClipboard}
          className={`w-full ${isBitcoin ? 'border-strong hover:bg-bitcoinOrange/10' : 'border-status-warning/30 hover:bg-status-warning-subtle'}`}
        >
          <Copy className="w-3 h-3 mr-1" />
          Copy Address
        </Button>
      </div>
    </div>
  );
}

interface BitcoinDonationCardProps {
  bitcoinAddress?: string;
  lightningAddress?: string;
  balance?: number; // in satoshis
  className?: string;
}

export default function BitcoinDonationCard({
  bitcoinAddress,
  lightningAddress,
  balance,
  className = '',
}: BitcoinDonationCardProps) {
  const userCurrency = useUserCurrency();

  if (!bitcoinAddress && !lightningAddress) {
    return null;
  }

  // Format balance in user's preferred currency
  const formatBalance = (balanceSats: number) => {
    const displayAmount = convert(balanceSats, 'SATS', userCurrency);
    return formatCurrency(displayAmount, userCurrency, { compact: true });
  };

  return (
    <div
      className={`${GRADIENTS.sectionOrangeAmber} rounded-lg border-2 border-bitcoinOrange/30 p-6 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-fg-primary flex items-center gap-2">
            <Bitcoin className="w-5 h-5 text-bitcoinOrange" />
            Accept Bitcoin Funding
          </h3>
          <p className="text-xs text-fg-secondary mt-0.5">Send Bitcoin directly to this profile</p>
        </div>
        {balance !== undefined && balance > 0 && (
          <div className="text-right">
            <div className="text-xs text-fg-secondary">Balance</div>
            <div className="text-sm font-bold text-fg-primary">{formatBalance(balance)}</div>
            <div className="text-xs text-fg-tertiary">
              ≈ {formatCurrency(balance, 'SATS', { compact: true })}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {bitcoinAddress && (
          <AddressCard
            type="bitcoin"
            address={bitcoinAddress}
            label="Bitcoin"
            description="On-chain"
          />
        )}
        {lightningAddress && (
          <AddressCard
            type="lightning"
            address={lightningAddress}
            label="Lightning"
            description="Instant payments"
          />
        )}
      </div>
    </div>
  );
}

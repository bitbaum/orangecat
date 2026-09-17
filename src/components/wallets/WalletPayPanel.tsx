'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { truncateAddress } from '@/utils/string';
import { getWalletReceiveHandle } from '@/lib/wallet-receive-handle';

interface Props {
  wallet: {
    address_or_xpub: string | null;
    lightning_address: string | null;
    wallet_type: string | null;
  };
}

/**
 * How this wallet is paid — the interactive half of the wallet page.
 *
 * The handle is resolved by `getWalletReceiveHandle`, not by reading the row
 * here: a wallet carries at most one usable public handle, and the surfaces
 * that guessed instead rendered `bitcoin:null` QR codes to would-be supporters.
 * An xpub wallet redacted for a visitor is still a valid destination — it just
 * has no handle to show, because the payer is given a freshly derived address
 * at invoice time rather than the key itself.
 */
export default function WalletPayPanel({ wallet }: Props) {
  const [copied, setCopied] = useState(false);
  const handle = getWalletReceiveHandle(wallet);

  const copy = async () => {
    if (!handle.value) {
      return;
    }
    await navigator.clipboard.writeText(handle.value);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-xs font-medium uppercase tracking-caps text-fg-secondary">
          {handle.label}
        </span>
        {handle.value && (
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 text-xs text-fg-secondary hover:text-fg-primary transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>

      <code
        onClick={handle.value ? copy : undefined}
        className={`block font-mono text-sm break-all rounded-lg bg-surface-base p-3 ${
          handle.value ? 'cursor-pointer hover:bg-surface-base/70 transition-colors' : ''
        }`}
        title={handle.value ? 'Click to copy' : undefined}
      >
        {handle.kind === 'onchain' && handle.value
          ? truncateAddress(handle.value, 20, 10)
          : (handle.value ?? handle.emptyText)}
      </code>

      {/* A QR is only drawn for something actually scannable. */}
      {handle.qrValue && (
        <>
          <div className="mt-5 flex justify-center">
            <div className="rounded-xl bg-white p-4">
              <QRCodeSVG value={handle.qrValue} size={168} />
            </div>
          </div>
          <Button
            onClick={() => {
              window.location.href = handle.qrValue as string;
              setTimeout(() => {
                toast.info("If your wallet didn't open, copy the address and paste it manually");
              }, 500);
            }}
            className="w-full mt-4 bg-bitcoinOrange hover:bg-bitcoinOrange/90 text-white"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in wallet
          </Button>
        </>
      )}
    </div>
  );
}

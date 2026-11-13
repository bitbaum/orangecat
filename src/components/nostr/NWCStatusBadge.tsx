'use client';

/**
 * NWC Status Badge
 *
 * Compact indicator showing Nostr Wallet Connect status.
 * Use in navigation bar or wallet section headers.
 *
 * Created: 2026-02-25
 */

import { Zap } from 'lucide-react';
import { useNostr } from '@/hooks/useNostr';
import { cn } from '@/lib/utils';

interface NWCStatusBadgeProps {
  className?: string;
  showLabel?: boolean;
}

export function NWCStatusBadge({ className, showLabel = false }: NWCStatusBadgeProps) {
  const { nwcConnected, connected } = useNostr();

  if (!connected) {
    return null;
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 text-xs',
        nwcConnected ? 'text-status-positive' : 'text-fg-secondary',
        className
      )}
      title={nwcConnected ? 'NWC Wallet Connected' : 'No wallet connected'}
    >
      <Zap
        className={cn('h-3.5 w-3.5', nwcConnected ? 'text-bitcoinOrange fill-bitcoinOrange' : '')}
      />
      {showLabel && <span>{nwcConnected ? 'NWC Active' : 'No Wallet'}</span>}
    </div>
  );
}

/**
 * MissingWalletBanner Component
 *
 * Displays a prominent banner on project pages when the Bitcoin address is missing.
 * Prompts the project owner to add their wallet to start receiving funding.
 *
 * Purpose: Convert demo projects into active fundraising campaigns.
 *
 * @module components/project
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Wallet, AlertCircle, X, ExternalLink } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

interface MissingWalletBannerProps {
  projectId: string;
  isOwner: boolean;
  className?: string;
}

/**
 * Banner prompting project owners to add a Bitcoin address
 */
export default function MissingWalletBanner({
  projectId,
  isOwner,
  className = '',
}: MissingWalletBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Only show to project owners
  if (!isOwner || isDismissed) {
    return null;
  }

  return (
    <div
      className={`bg-bitcoinOrange/5 border-2 border-bitcoinOrange/30 rounded-lg p-4 shadow-sm ${className}`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-lg bg-bitcoinOrange/15 flex items-center justify-center flex-shrink-0">
          <Wallet className="w-5 h-5 text-bitcoinOrange" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-lg font-semibold text-fg-primary">
              Add Your Bitcoin Address to Start Receiving Funding
            </h3>
            <button
              onClick={() => setIsDismissed(true)}
              className="text-fg-tertiary hover:text-fg-secondary dark:hover:text-fg-primary transition-colors flex-shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-fg-primary mb-4">
            Your project is live, but you can't receive funding yet! Add your Bitcoin or Lightning
            address so supporters can contribute.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Link href={ROUTES.PROJECTS.EDIT(projectId)}>
              <Button className="bg-bitcoinOrange hover:bg-bitcoinOrange/90 text-white">
                <Wallet className="w-4 h-4 mr-2" />
                Add Wallet Address
              </Button>
            </Link>

            <Link href={ROUTES.WALLETS.LIST} target="_blank">
              <Button
                variant="outline"
                className="border-bitcoinOrange/40 text-bitcoinOrange hover:bg-bitcoinOrange/5"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Get a Wallet First
              </Button>
            </Link>
          </div>

          {/* Info */}
          <div className="mt-4 flex items-start gap-2 text-xs text-fg-secondary">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-bitcoinOrange" />
            <p>
              <strong>Self-custodial:</strong> Funding goes directly to your wallet. No KYC, no
              middleman.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

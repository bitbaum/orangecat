/**
 * Wallets Help Section
 *
 * Help section component with tips and guidance.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 */

'use client';

import { AlertCircle } from 'lucide-react';

interface WalletsHelpSectionProps {
  isDesktop: boolean;
}

export function WalletsHelpSection({ isDesktop }: WalletsHelpSectionProps) {
  return (
    <details className="mt-6 lg:mt-8 bg-surface-raised rounded-lg overflow-hidden" open={isDesktop}>
      <summary className="p-4 lg:p-6 flex items-start gap-3 cursor-pointer list-none">
        <AlertCircle className="w-5 h-5 text-fg-secondary mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-sm lg:text-base text-fg-primary mb-0 lg:mb-2">
            Quick tips
          </p>
          {/* Mobile: Show only key point, Desktop: Show all */}
          <p className="lg:hidden text-xs text-fg-secondary mt-1">
            Lightning arrives in seconds • Never paste your seed phrase
          </p>
        </div>
        <svg
          className="w-5 h-5 text-fg-secondary flex-shrink-0 lg:hidden transition-transform"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-4 pb-4 lg:px-6 lg:pb-6 pt-0 border-t border-default">
        <div className="text-sm text-fg-primary">
          <ul className="list-disc list-inside space-y-1.5">
            <li>
              <strong>A Lightning address is the easiest way to get paid</strong> — it looks like an
              email, and payments land in seconds. It also switches on your{' '}
              <code className="font-mono text-xs">@orangecat.ch</code> address above.
            </li>
            <li>
              An on-chain address (1..., 3..., bc1...) works too, but payments take ~10 minutes and
              can&apos;t answer Lightning.
            </li>
            <li>Never paste your seed phrase here – only public data</li>
            <li>Active wallets appear on the Wallets tab of your public profile</li>
          </ul>
          <details className="mt-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-fg-primary hover:underline underline-offset-4 text-xs font-medium">
              What about extended public keys (xpub/ypub/zpub)?
            </summary>
            <p className="mt-2 text-xs text-fg-secondary pl-4">
              The best way to receive on-chain. With an extended public key, OrangeCat derives a
              fresh address for every payment request — the way Bitcoin wallets are designed to be
              paid. Each payer sees their own address, which protects your privacy and lets us
              reliably detect exactly which payment arrived. A single reused address can&apos;t do
              either. It can&apos;t receive Lightning.
            </p>
          </details>
        </div>
      </div>
    </details>
  );
}

/**
 * Wallets Guidance Sidebar
 *
 * Desktop guidance sidebar component.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 */

'use client';

import { DynamicSidebar } from '@/components/create/DynamicSidebar';
import {
  walletGuidanceContent,
  walletDefaultContent,
  type WalletFieldType,
} from '@/lib/wallet-guidance';

interface WalletsGuidanceSidebarProps {
  focusedField: WalletFieldType;
}

export function WalletsGuidanceSidebar({ focusedField }: WalletsGuidanceSidebarProps) {
  return (
    <div className="hidden lg:block lg:col-span-5 lg:order-2">
      <div className="lg:sticky lg:top-20 space-y-6">
        {/* A static "How wallet setup works" card used to sit here, duplicating
            walletDefaultContent below (which the DynamicSidebar already shows
            when no field is focused) and still telling people to paste an xpub.
            One explainer, one source of truth. */}

        {/* Dynamic Guidance */}
        <DynamicSidebar<NonNullable<WalletFieldType>>
          activeField={focusedField}
          guidanceContent={walletGuidanceContent}
          defaultContent={walletDefaultContent}
        />
      </div>
    </div>
  );
}

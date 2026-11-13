'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Wallet } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import type { GroupWalletSummary } from '@/services/groups/types';
import { GroupWalletCard } from './GroupWalletCard';
import { GroupWalletCreateForm } from './GroupWalletCreateForm';

interface GroupWalletsProps {
  groupId: string;
  groupSlug: string;
  /**
   * null: this viewer cannot read the group's wallets. group_wallets is
   * readable by members only, so a visitor's list is empty whatever the group
   * holds — never show that as "No wallets yet".
   */
  wallets: unknown[] | null;
  /** Founder or admin — the only roles POST /api/groups/[slug]/wallets accepts. */
  canManage: boolean;
  onUpdate?: () => void;
}

// Type guard for wallet summary
const isWalletSummary = (w: unknown): w is GroupWalletSummary => {
  return typeof w === 'object' && w !== null && 'id' in w && 'name' in w;
};

export function GroupWallets({
  groupId: _groupId,
  groupSlug,
  wallets,
  canManage,
  onUpdate,
}: GroupWalletsProps) {
  if (wallets === null) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState icon={Wallet} title="Wallets are visible to members" className="py-8" />
        </CardContent>
      </Card>
    );
  }

  const typedWallets = wallets.filter(isWalletSummary);

  return (
    <div className="space-y-4">
      {canManage && <GroupWalletCreateForm groupSlug={groupSlug} onCreated={onUpdate} />}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Wallets ({typedWallets.length})
          </CardTitle>
          <CardDescription>Bitcoin wallets for this group</CardDescription>
        </CardHeader>
        <CardContent>
          {typedWallets.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No wallets yet"
              description={
                canManage
                  ? 'Use “Create New Wallet” above to add a Bitcoin wallet so this group can receive funds together.'
                  : 'A founder or admin of this group can add a Bitcoin wallet so it can receive funds together.'
              }
              className="py-8"
            />
          ) : (
            <div className="space-y-4">
              {typedWallets.map(wallet => (
                <GroupWalletCard
                  key={wallet.id}
                  wallet={wallet}
                  groupSlug={groupSlug}
                  canRefresh={canManage}
                  onUpdate={onUpdate}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

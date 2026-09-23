'use client';

/**
 * Receive — the door you share.
 *
 * One link. The Lightning name is that same door typed into a wallet app.
 * The coins land in the wallet the owner connected. This page does not mint
 * an invoice and does not ask which wallet: a payer types the amount on the
 * link, and a choice between two rows that pay the same place is not a choice.
 */

import { useCallback, useEffect, useState } from 'react';
import { ReceiveSetup } from '@/components/receive/ReceiveSetup';
import { SharePayLink } from '@/components/receive/SharePayLink';
import { MoneyLoading, MoneyPage } from '@/components/money/MoneyPage';
import { useRequireAuth } from '@/hooks/useAuth';
import { fetchReceiveOverview, type OwnerReceiveOverview } from '@/services/receive/receive-client';
import { RECEIVE_COPY } from '@/config/receive';

export function ReceiveScreen() {
  const { user, profile, isLoading: authLoading } = useRequireAuth();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OwnerReceiveOverview | null>(null);

  const reload = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    setOverview(await fetchReceiveOverview());
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    let active = true;
    reload()
      .catch(() => {
        if (active) {
          setOverview(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [user?.id, reload]);

  if (authLoading || loading) {
    return <MoneyLoading />;
  }

  if (!overview?.rail) {
    return (
      <ReceiveSetup
        profileId={profile?.id ?? user?.id}
        onConnected={() => {
          void reload().catch(() => setOverview(null));
        }}
      />
    );
  }

  const address = overview.lightningAddressActive ? overview.lightningAddress : null;

  return (
    <MoneyPage title={RECEIVE_COPY.title} subtitle={RECEIVE_COPY.subtitle}>
      <div className="space-y-4">
        {overview.rail === 'onchain' && (
          <p className="text-center text-sm text-fg-tertiary">{RECEIVE_COPY.onchainNote}</p>
        )}
        {overview.username && (
          <SharePayLink
            username={overview.username}
            walletAddress={address}
            arrivesAt={overview.arrivesAt}
          />
        )}
        {!overview.arrivesAt && overview.rail !== 'onchain' && (
          <p className="text-center text-sm text-fg-secondary">{RECEIVE_COPY.arrivesInApp}</p>
        )}
      </div>
    </MoneyPage>
  );
}

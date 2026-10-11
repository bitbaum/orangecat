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
import Button from '@/components/ui/Button';

export function ReceiveScreen() {
  const { user, profile, isLoading: authLoading } = useRequireAuth();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OwnerReceiveOverview | null>(null);
  // A failed load is not "nothing set up": showing the setup screen on an
  // error asked people who already receive payments to paste a wallet again.
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    const next = await fetchReceiveOverview();
    setOverview(next);
    setFailed(Boolean(next.checkFailed));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    let active = true;
    reload()
      .catch(() => {
        if (active) {
          setFailed(true);
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

  if (failed) {
    return (
      <MoneyPage title={RECEIVE_COPY.title} subtitle={RECEIVE_COPY.subtitle}>
        <div className="oc-error-surface space-y-3 rounded-lg p-4 text-center">
          <p className="text-sm text-fg-primary">Couldn&apos;t load your receiving setup.</p>
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true);
              setFailed(false);
              void reload()
                .catch(() => setFailed(true))
                .finally(() => setLoading(false));
            }}
          >
            Try again
          </Button>
        </div>
      </MoneyPage>
    );
  }

  if (!overview?.rail) {
    return (
      <ReceiveSetup
        profileId={profile?.id ?? user?.id}
        onConnected={() => {
          void reload().catch(() => setFailed(true));
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

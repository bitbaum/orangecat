'use client';

/**
 * Receive — the screen the bottom bar's QR slot opens.
 *
 * It opens on the code: who it pays, the QR, the link, Copy and Share. Under
 * it, every way this account is paid — Bitcoin first (the rail OrangeCat runs:
 * the link and <username>@orangecat.ch are the same door, settling in the
 * owner's own wallet), then the other apps the owner listed. OrangeCat never
 * holds the money on any of them.
 *
 * A failed load is not "nothing set up": showing the setup screen on an error
 * asked people who already receive payments to paste a wallet again. And an
 * account with no Bitcoin wallet still gets its code — the pay page shows the
 * other ways — so the setup screen is offered only when there is no way at all.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AddWayToPaySheet } from '@/components/receive/AddWayToPaySheet';
import { ReceiveCode } from '@/components/receive/ReceiveCode';
import { ReceiveSetup } from '@/components/receive/ReceiveSetup';
import { WaysToPay } from '@/components/receive/WaysToPay';
import { MoneyLoading, MoneyPage } from '@/components/money/MoneyPage';
import { useRequireAuth } from '@/hooks/useAuth';
import { fetchReceiveOverview, type OwnerReceiveOverview } from '@/services/receive/receive-client';
import {
  fetchPaymentMethods,
  removePaymentMethod,
  type PaymentMethodRow,
} from '@/services/payment-methods/payment-methods-client';
import { PAYMENT_METHODS_COPY } from '@/config/payment-methods';
import { RECEIVE_COPY } from '@/config/receive';
import { haptic } from '@/lib/haptics';
import Button from '@/components/ui/Button';

export function ReceiveScreen() {
  const { user, profile, isLoading: authLoading } = useRequireAuth();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OwnerReceiveOverview | null>(null);
  const [methods, setMethods] = useState<PaymentMethodRow[]>([]);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    const [next, rows] = await Promise.all([
      fetchReceiveOverview(),
      // The list is secondary: a failed read leaves the code on screen.
      fetchPaymentMethods().catch(() => [] as PaymentMethodRow[]),
    ]);
    setOverview(next);
    setMethods(rows);
    setFailed(Boolean(next.checkFailed));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    let active = true;
    reload()
      .catch(() => active && setFailed(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user?.id, reload]);

  const handleRemove = useCallback(async (id: string) => {
    setRemovingId(id);
    try {
      await removePaymentMethod(id);
      setMethods(rows => rows.filter(r => r.id !== id));
      toast.success(PAYMENT_METHODS_COPY.removed);
    } catch (e) {
      haptic('error');
      toast.error(e instanceof Error ? e.message : 'Could not remove that.');
    } finally {
      setRemovingId(null);
    }
  }, []);

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

  // No Bitcoin rail and no other way either: ask once, skippable.
  if (!overview?.rail && methods.length === 0 && !adding) {
    return (
      <ReceiveSetup
        profileId={profile?.id ?? user?.id}
        onConnected={() => void reload().catch(() => setFailed(true))}
        onAddOtherWay={() => setAdding(true)}
      />
    );
  }

  const username = overview?.username ?? profile?.username ?? null;

  return (
    <MoneyPage title={RECEIVE_COPY.title} subtitle={RECEIVE_COPY.subtitle}>
      {username && (
        <ReceiveCode
          username={username}
          name={profile?.name ?? username}
          avatarUrl={profile?.avatar_url}
          withAmount
        />
      )}
      {overview?.rail === 'onchain' && (
        <p className="mt-3 text-center text-sm text-fg-tertiary">{RECEIVE_COPY.onchainNote}</p>
      )}

      <WaysToPay
        bitcoin={{
          active: Boolean(overview?.rail),
          address: overview?.lightningAddressActive ? overview.lightningAddress : null,
          arrivesAt: overview?.arrivesAt ?? null,
        }}
        methods={methods}
        onAdd={() => setAdding(true)}
        onRemove={id => void handleRemove(id)}
        removingId={removingId}
      />

      <AddWayToPaySheet
        isOpen={adding}
        onClose={() => setAdding(false)}
        onAdded={row => setMethods(rows => [...rows, row])}
      />
    </MoneyPage>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { detectWalletType, type Wallet } from '@/types/wallet';
import { PAY_DESTINATION_COPY } from '@/config/pay-destination';
import { WalletCard } from './WalletCard';
import { WalletPasteField } from './WalletPasteField';
import { applyWalletSelection } from './applyWalletSelection';
import { API_ROUTES } from '@/config/api-routes';

interface WalletSelectorFieldProps {
  formData: Record<string, unknown>;
  onFieldChange: (field: string, value: unknown) => void;
  disabled?: boolean;
}

type Mode = 'select' | 'paste';

export function WalletSelectorField({
  formData,
  onFieldChange,
  disabled = false,
}: WalletSelectorFieldProps) {
  const { profile, user } = useAuth();
  const profileId = profile?.id ?? user?.id;
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('select');
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(
    (formData._wallet_id as string) || null
  );

  const fetchWallets = useCallback(async () => {
    if (!profileId) {
      setIsLoading(false);
      setMode('paste');
      return;
    }

    try {
      setIsLoading(true);
      setFetchError(null);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_ROUTES.WALLETS.BASE}?profile_id=${profileId}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        const data = Array.isArray(result.data) ? result.data : [];
        setWallets(data);
        // No saved destination: the paste box, never two protocol fields.
        if (data.length === 0) {
          setMode('paste');
        }
      } else {
        setFetchError('Could not load wallets');
        setMode('paste');
      }
    } catch {
      setFetchError('Could not load wallets');
      setMode('paste');
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  // Pre-select the user's primary wallet once loaded so an existing address is
  // tied to the entity by default (they can switch or enter another). Without
  // this, a user who has a wallet but never clicks a card creates an entity with
  // no explicit link — and may not realise their address could be attached.
  const didPreselect = useRef(false);
  useEffect(() => {
    if (didPreselect.current || wallets.length === 0) {
      return;
    }
    didPreselect.current = true;

    // Honour an existing selection (edit mode) instead of overriding it.
    if (formData._wallet_id) {
      setSelectedWalletId(formData._wallet_id as string);
      return;
    }

    const primary = wallets.find(w => w.is_primary) ?? wallets[0];
    setSelectedWalletId(primary.id);
    applyWalletSelection(onFieldChange, primary);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once after wallets load
  }, [wallets]);

  // Reuse warning: attaching a wallet that already collects for other pages
  // makes those pages publicly linkable on-chain. Warn at the moment of
  // attachment — including the silent auto-preselect above — so reuse is a
  // choice, not an accident. Best-effort: a failed lookup shows no warning.
  const [reuseInfo, setReuseInfo] = useState<{ count: number; isXpubWallet: boolean } | null>(null);
  useEffect(() => {
    if (!selectedWalletId) {
      setReuseInfo(null);
      return;
    }
    const wallet = wallets.find(w => w.id === selectedWalletId);
    const isXpubWallet = wallet?.address_or_xpub
      ? detectWalletType(wallet.address_or_xpub) === 'xpub'
      : false;
    let cancelled = false;
    fetch(`${API_ROUTES.ENTITY_WALLETS}?wallet_id=${selectedWalletId}`)
      .then(res => (res.ok ? res.json() : null))
      .then(result => {
        if (cancelled || !result) {
          return;
        }
        const rows: Array<{ entity_id: string }> = Array.isArray(result.data) ? result.data : [];
        // In edit mode the entity's own existing link must not count as reuse.
        const currentEntityId = formData.id as string | undefined;
        const count = rows.filter(r => r.entity_id !== currentEntityId).length;
        setReuseInfo({ count, isXpubWallet });
      })
      .catch(() => {
        if (!cancelled) {
          setReuseInfo(null);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- formData.id is stable per form
  }, [selectedWalletId, wallets]);

  const handleSelectWallet = (wallet: Wallet) => {
    setSelectedWalletId(wallet.id);
    applyWalletSelection(onFieldChange, wallet);
  };

  const handleWalletSaved = (wallet: Wallet) => {
    setWallets(prev =>
      prev.some(existing => existing.id === wallet.id) ? prev : [...prev, wallet]
    );
    setSelectedWalletId(wallet.id);
    applyWalletSelection(onFieldChange, wallet);
    setMode('select');
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 justify-center text-fg-secondary">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading wallets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mode === 'select' && wallets.length > 0 && (
        <>
          <p className="text-sm font-medium text-fg-primary">{PAY_DESTINATION_COPY.payInto}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {wallets.map(wallet => (
              <WalletCard
                key={wallet.id}
                wallet={wallet}
                selected={selectedWalletId === wallet.id}
                onSelect={() => handleSelectWallet(wallet)}
                disabled={disabled}
              />
            ))}
          </div>
          {reuseInfo && reuseInfo.count > 0 && !reuseInfo.isXpubWallet && (
            <p className="rounded-lg border border-status-warning/40 bg-status-warning-subtle px-3 py-2 text-xs text-fg-secondary">
              This wallet already receives funds for {reuseInfo.count} other{' '}
              {reuseInfo.count === 1 ? 'page' : 'pages'}. On-chain payments to the same address are
              publicly linkable — anyone can connect these pages on the blockchain. For separate
              identities, pick a different wallet, or use an xpub wallet to get a fresh address per
              payment.
            </p>
          )}
          {reuseInfo && reuseInfo.count > 0 && reuseInfo.isXpubWallet && (
            <p className="text-xs text-fg-secondary">
              This wallet collects for {reuseInfo.count} other{' '}
              {reuseInfo.count === 1 ? 'page' : 'pages'}, but it derives a fresh address per payment
              — payments aren&apos;t linkable on-chain.
            </p>
          )}
          <button
            type="button"
            onClick={() => setMode('paste')}
            disabled={disabled}
            className="text-sm font-medium text-accent-warm underline hover:text-accent-warm-hover disabled:opacity-50"
          >
            {PAY_DESTINATION_COPY.differentDestination}
          </button>
        </>
      )}

      {mode === 'paste' && (
        <WalletPasteField
          profileId={profileId}
          defaultLabel={wallets.length === 0 ? 'Main' : 'Another destination'}
          hideIntro={wallets.length > 0}
          cancelLabel={wallets.length > 0 ? PAY_DESTINATION_COPY.back : undefined}
          onCancel={wallets.length > 0 ? () => setMode('select') : undefined}
          onSaved={handleWalletSaved}
        />
      )}

      {fetchError && wallets.length === 0 && (
        <p className="text-xs text-fg-secondary">{fetchError}</p>
      )}
    </div>
  );
}

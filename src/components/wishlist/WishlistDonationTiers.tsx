/**
 * Wishlist Support Tiers Component
 *
 * Fetches and displays wishlist items as preset support tiers.
 * Displays amounts in user's preferred currency while transactions use BTC.
 *
 * Note: Uses "support" terminology per domain-specific.md (not "donation").
 *
 * Created: 2026-01-07
 * Last Modified: 2026-01-29
 * Last Modified Summary: Updated terminology from "donation" to "support"
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Gift, Loader2 } from 'lucide-react';
import { logger } from '@/utils/logger';
import { PaymentDialog } from '@/components/payment';
import { useUserCurrency } from '@/hooks/useUserCurrency';
import { convert, formatCurrency, displayBTC } from '@/services/currency';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { API_ROUTES } from '@/config/api-routes';

interface WishlistItem {
  id: string;
  title: string;
  target_amount_btc: number;
  funded_amount_btc: number;
  image_url?: string;
}

interface WishlistDonationTiersProps {
  userId: string;
  projectId: string;
  projectTitle?: string;
}

export function WishlistDonationTiers({
  userId,
  projectId,
  projectTitle = ENTITY_REGISTRY.project.name,
}: WishlistDonationTiersProps) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<WishlistItem | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const userCurrency = useUserCurrency();

  useEffect(() => {
    if (!userId) {
      return;
    }

    const controller = new AbortController();
    const fetchTiers = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(API_ROUTES.PROFILES.WISHLIST_TIERS(userId), {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        if (response.ok) {
          const data = await response.json();
          if (controller.signal.aborted) {
            return;
          }
          setItems(data.data?.items || []);
        }
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError') {
          return;
        }
        logger.error('Failed to fetch wishlist tiers', error, 'Wishlist');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchTiers();
    return () => controller.abort();
  }, [userId]);

  const handleTierClick = (item: WishlistItem) => {
    setSelectedItem(item);
    setIsPaymentModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-bitcoinOrange" />
      </div>
    );
  }

  if (items.length === 0) {
    return null; // Don't show anything if no wishlist items
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Gift className="h-5 w-5 text-fg-secondary" />
        <h4 className="font-semibold text-fg-primary">Support a specific goal:</h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map(item => {
          // target_amount_btc is BTC. Convert from BTC (not from SATS — the
          // previous code passed BTC values to convert() with fromCurrency='SATS',
          // which interpreted 0.001 BTC as 0.001 sats ≈ zero fiat).
          const displayAmount = convert(item.target_amount_btc, 'BTC', userCurrency);
          const formattedAmount = formatCurrency(displayAmount, userCurrency, { compact: true });
          const btcDisplay = displayBTC(item.target_amount_btc);

          return (
            <button
              key={item.id}
              onClick={() => handleTierClick(item)}
              className="flex flex-col items-start p-4 border-2 border-default rounded-lg hover:border-bitcoinOrange hover:bg-bitcoinOrange/5 transition-all text-left group"
            >
              <span className="text-sm font-bold text-fg-primary group-hover:text-bitcoinOrange">
                {formattedAmount}
              </span>
              <span className="text-xs text-fg-tertiary mt-0.5">≈ {btcDisplay}</span>
              <span className="text-xs text-fg-secondary mt-1 line-clamp-1">{item.title}</span>
              <div className="w-full bg-surface-raised rounded-full h-1 mt-3">
                <div
                  className="bg-bitcoinOrange h-1 rounded-full"
                  style={{
                    width: `${Math.min(100, (item.funded_amount_btc / item.target_amount_btc) * 100)}%`,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {selectedItem && (
        <PaymentDialog
          open={isPaymentModalOpen}
          onOpenChange={setIsPaymentModalOpen}
          entityType="project"
          entityId={projectId}
          entityTitle={`${projectTitle} - ${selectedItem.title}`}
          defaultAmount={selectedItem.target_amount_btc}
        />
      )}
    </div>
  );
}

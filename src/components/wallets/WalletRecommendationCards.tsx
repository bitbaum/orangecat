'use client';

import { useState, useMemo } from 'react';
import Button from '@/components/ui/Button';
import { WALLET_PROVIDERS } from '@/config/wallet-providers';
import { RecommendedWalletCard } from './RecommendedWalletCard';
import { WalletRecommendationFilterBar } from './WalletRecommendationFilterBar';
import type { RecommendedWallet } from './RecommendedWalletCard';
import type { RecommendationFilters } from './WalletRecommendationFilterBar';

/**
 * Editorial only — which self-custody wallets this page features, in what order,
 * and how it describes them. Name, website, platform and custody come from
 * `@/config/wallet-providers`, so this page cannot drift from the guide page or
 * from what the Cat tells someone who has no wallet yet.
 */
const CARD_EDITORIAL: Array<{
  providerId: string;
  description: string;
  level: RecommendedWallet['level'];
  downloadLinks?: RecommendedWallet['downloadLinks'];
  recommended: boolean;
}> = [
  {
    providerId: 'bluewallet',
    description: 'Best all-around mobile wallet with easy Lightning and on-chain support',
    level: 'beginner',
    downloadLinks: {
      ios: 'https://apps.apple.com/app/bluewallet-bitcoin-wallet/id1376878040',
      android: 'https://play.google.com/store/apps/details?id=io.bluewallet.bluewallet',
    },
    recommended: true,
  },
  {
    providerId: 'phoenix',
    description: 'Simple mobile Lightning wallet with automatic channel management',
    level: 'beginner',
    downloadLinks: {
      ios: 'https://apps.apple.com/app/phoenix-wallet/id6449854979',
      android: WALLET_PROVIDERS.phoenix.website,
    },
    recommended: true,
  },
  {
    providerId: 'breez',
    description: 'Non-custodial Lightning wallet with creator tools and instant payments',
    level: 'beginner',
    downloadLinks: {
      ios: 'https://apps.apple.com/app/breez-lightning-client-pos/id1473040547',
      android: 'https://play.google.com/store/apps/details?id=com.breez.client',
    },
    recommended: false,
  },
  {
    providerId: 'electrum',
    description: 'Powerful, lightweight desktop wallet with advanced features',
    level: 'advanced',
    downloadLinks: {},
    recommended: false,
  },
  {
    providerId: 'sparrow',
    description: 'Privacy-focused desktop wallet with CoinJoin and full control',
    level: 'advanced',
    downloadLinks: {},
    recommended: false,
  },
];

const WALLETS: RecommendedWallet[] = CARD_EDITORIAL.map(({ providerId, ...editorial }) => {
  const provider = WALLET_PROVIDERS[providerId];
  return {
    name: provider.name,
    website: provider.website,
    // This page only shows phone/laptop apps; the filter bar has no third option.
    platform: provider.formFactor === 'desktop' ? 'desktop' : 'mobile',
    lightning: provider.lightning,
    custodial: provider.custody === 'custodial',
    ...editorial,
  };
});

export default function WalletRecommendationCards() {
  const [filters, setFilters] = useState<RecommendationFilters>({
    platform: [],
    level: [],
    lightning: false,
  });

  const togglePlatform = (platform: 'mobile' | 'desktop') => {
    setFilters(prev => ({
      ...prev,
      platform: prev.platform.includes(platform)
        ? prev.platform.filter(p => p !== platform)
        : [...prev.platform, platform],
    }));
  };

  const toggleLevel = (level: 'beginner' | 'advanced') => {
    setFilters(prev => ({
      ...prev,
      level: prev.level.includes(level)
        ? prev.level.filter(l => l !== level)
        : [...prev.level, level],
    }));
  };

  const toggleLightning = () => {
    setFilters(prev => ({ ...prev, lightning: !prev.lightning }));
  };

  const resetFilters = () => {
    setFilters({ platform: [], level: [], lightning: false });
  };

  const hasActiveFilters =
    filters.platform.length > 0 || filters.level.length > 0 || filters.lightning;

  const filteredWallets = useMemo(() => {
    const result = WALLETS.filter(wallet => {
      if (filters.platform.length > 0 && !filters.platform.includes(wallet.platform)) {
        return false;
      }
      if (filters.level.length > 0 && !filters.level.includes(wallet.level)) {
        return false;
      }
      if (filters.lightning && !wallet.lightning) {
        return false;
      }
      return true;
    });

    result.sort((a, b) => {
      if (!hasActiveFilters && a.recommended !== b.recommended) {
        return a.recommended ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [filters, hasActiveFilters]);

  return (
    <div className="w-full">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-fg-primary mb-2">
          Find the perfect Bitcoin wallet for receiving funding
        </h2>
        <p className="text-fg-secondary">
          All recommendations are self-custodial — you hold your keys. Payments go straight to your
          wallet; OrangeCat never holds them.
        </p>
      </div>

      <WalletRecommendationFilterBar
        filters={filters}
        hasActiveFilters={hasActiveFilters}
        onTogglePlatform={togglePlatform}
        onToggleLevel={toggleLevel}
        onToggleLightning={toggleLightning}
        onReset={resetFilters}
      />

      {filteredWallets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWallets.map(wallet => (
            <RecommendedWalletCard key={wallet.name} wallet={wallet} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-fg-secondary mb-4">No wallets match your filters.</p>
          <Button onClick={resetFilters} variant="outline" size="sm">
            Reset filters
          </Button>
        </div>
      )}
    </div>
  );
}

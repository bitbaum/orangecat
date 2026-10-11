'use client';

import { Smartphone, Monitor, Zap, Shield, ExternalLink } from 'lucide-react';
import Card from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface RecommendedWallet {
  name: string;
  description: string;
  platform: 'mobile' | 'desktop';
  level: 'beginner' | 'advanced';
  lightning: boolean;
  custodial: boolean;
  downloadLinks?: {
    ios?: string;
    android?: string;
  };
  website: string;
  recommended: boolean;
}

interface RecommendedWalletCardProps {
  wallet: RecommendedWallet;
}

export function RecommendedWalletCard({ wallet }: RecommendedWalletCardProps) {
  return (
    <Card
      className={cn(
        'p-6 relative overflow-hidden transition-all duration-300',
        wallet.recommended && 'ring-2 ring-fg-primary/20 border-strong'
      )}
    >
      {wallet.recommended && (
        <div className="absolute top-0 right-0 bg-fg-primary text-fg-inverted text-xs font-semibold px-3 py-1 rounded-bl-lg">
          Recommended
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-fg-primary mb-2">{wallet.name}</h3>
          <p className="text-sm text-fg-secondary leading-relaxed">{wallet.description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className={cn(
              'text-xs',
              wallet.platform === 'mobile'
                ? 'bg-surface-raised text-fg-primary border-subtle'
                : 'bg-surface-raised text-fg-primary border-subtle'
            )}
          >
            {wallet.platform === 'mobile' ? (
              <Smartphone className="w-3 h-3 mr-1" />
            ) : (
              <Monitor className="w-3 h-3 mr-1" />
            )}
            {wallet.platform === 'mobile' ? 'Mobile' : 'Desktop'}
          </Badge>

          <Badge
            variant="outline"
            className={cn(
              'text-xs',
              wallet.level === 'beginner'
                ? 'bg-status-positive-subtle text-status-positive border-status-positive/20'
                : 'bg-status-warning-subtle text-status-warning border-status-warning/20'
            )}
          >
            {wallet.level === 'beginner' ? 'Beginner' : 'Advanced'}
          </Badge>

          {wallet.lightning && (
            <Badge
              variant="outline"
              className="text-xs bg-bitcoinOrange/10 text-bitcoinOrange border-bitcoinOrange/20"
            >
              <Zap className="w-3 h-3 mr-1" />
              Lightning
            </Badge>
          )}

          {/* From the provider's custody, not assumed: a hard-coded badge lies the
              day a custodial wallet joins the list. */}
          {!wallet.custodial && (
            <Badge
              variant="outline"
              className="text-xs bg-surface-raised text-fg-primary border-default"
            >
              <Shield className="w-3 h-3 mr-1" />
              Non-custodial
            </Badge>
          )}
        </div>

        {wallet.downloadLinks && (wallet.downloadLinks.ios || wallet.downloadLinks.android) && (
          <div className="flex flex-col gap-2">
            {wallet.downloadLinks.ios && (
              <a
                href={wallet.downloadLinks.ios}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
              >
                <Smartphone className="w-4 h-4" />
                iOS App Store
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {wallet.downloadLinks.android && (
              <a
                href={wallet.downloadLinks.android}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                <Smartphone className="w-4 h-4" />
                Google Play
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        <a
          href={wallet.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-fg-primary hover:underline font-medium transition-colors"
        >
          Visit website
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </Card>
  );
}

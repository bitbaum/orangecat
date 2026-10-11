'use client';

import { Smartphone, Monitor, Zap, Shield, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RecommendationFilters {
  platform: ('mobile' | 'desktop')[];
  level: ('beginner' | 'advanced')[];
  lightning: boolean;
}

interface WalletRecommendationFilterBarProps {
  filters: RecommendationFilters;
  hasActiveFilters: boolean;
  onTogglePlatform: (platform: 'mobile' | 'desktop') => void;
  onToggleLevel: (level: 'beginner' | 'advanced') => void;
  onToggleLightning: () => void;
  onReset: () => void;
}

const ACTIVE_CLASS = 'bg-surface-raised text-fg-primary border-2 border-strong';
const INACTIVE_CLASS =
  'bg-surface-raised text-fg-primary border-2 border-transparent hover:bg-surface-raised/80';
const BTN_BASE =
  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all';

export function WalletRecommendationFilterBar({
  filters,
  hasActiveFilters,
  onTogglePlatform,
  onToggleLevel,
  onToggleLightning,
  onReset,
}: WalletRecommendationFilterBarProps) {
  return (
    <div className="mb-8 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-fg-primary">Platform:</span>
          <button
            onClick={() => onTogglePlatform('mobile')}
            className={cn(
              BTN_BASE,
              filters.platform.includes('mobile') ? ACTIVE_CLASS : INACTIVE_CLASS
            )}
          >
            <Smartphone className="w-4 h-4" />
            Mobile
          </button>
          <button
            onClick={() => onTogglePlatform('desktop')}
            className={cn(
              BTN_BASE,
              filters.platform.includes('desktop') ? ACTIVE_CLASS : INACTIVE_CLASS
            )}
          >
            <Monitor className="w-4 h-4" />
            Desktop
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-fg-primary">Level:</span>
          <button
            onClick={() => onToggleLevel('beginner')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              filters.level.includes('beginner') ? ACTIVE_CLASS : INACTIVE_CLASS
            )}
          >
            Beginner
          </button>
          <button
            onClick={() => onToggleLevel('advanced')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              filters.level.includes('advanced') ? ACTIVE_CLASS : INACTIVE_CLASS
            )}
          >
            Advanced
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-fg-primary">Features:</span>
          <button
            onClick={onToggleLightning}
            className={cn(BTN_BASE, filters.lightning ? ACTIVE_CLASS : INACTIVE_CLASS)}
          >
            <Zap className="w-4 h-4" />
            Lightning Support
          </button>
        </div>

        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-fg-secondary hover:text-fg-primary hover:bg-surface-raised transition-all"
          >
            <X className="w-4 h-4" />
            Reset filters
          </button>
        )}
      </div>

      <p className="text-xs text-fg-secondary flex items-center gap-1">
        <Shield className="w-3 h-3" />
        All wallets shown are non-custodial — you control your keys
      </p>
    </div>
  );
}

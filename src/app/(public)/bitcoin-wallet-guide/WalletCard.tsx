'use client';

import { motion } from 'framer-motion';
import { Bitcoin, Smartphone, Monitor, Globe, Lock, Star, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { BADGE_COLORS } from '@/config/badge-colors';
import type { WalletOption } from './config';

function getTypeIcon(type: WalletOption['type']) {
  switch (type) {
    case 'mobile':
      return Smartphone;
    case 'desktop':
      return Monitor;
    case 'browser':
      return Globe;
    case 'hardware':
      return Lock;
    default:
      return Bitcoin;
  }
}

function getDifficultyColor(difficulty: WalletOption['difficulty']) {
  switch (difficulty) {
    case 'beginner':
      return BADGE_COLORS.success;
    case 'intermediate':
      return BADGE_COLORS.warning;
    case 'advanced':
      return BADGE_COLORS.error;
    default:
      return BADGE_COLORS.muted;
  }
}

interface WalletCardProps {
  wallet: WalletOption;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function WalletCard({ wallet, isSelected, onSelect }: WalletCardProps) {
  const TypeIcon = getTypeIcon(wallet.type);
  // The recommended ring is a utility and would win over the selection ring
  // (a component class), leaving a selected recommended wallet unmarked.
  const frame = isSelected
    ? 'oc-selection-ring'
    : wallet.recommended
      ? 'oc-card-link border-default ring-1 ring-success/20'
      : 'oc-card-link border-default';

  return (
    <motion.div layout whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <Card
        className={`cursor-pointer transition-all duration-200 ${frame} ${
          wallet.recommended ? 'bg-status-positive/5' : ''
        }`}
        onClick={() => onSelect(wallet.id)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-surface-raised">
                <TypeIcon
                  className={`w-5 h-5 ${isSelected ? 'text-fg-primary' : 'text-fg-secondary'}`}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{wallet.name}</CardTitle>
                  {wallet.recommended && (
                    <div
                      className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${BADGE_COLORS.success}`}
                    >
                      <Star className="w-3 h-3" />
                      Recommended
                    </div>
                  )}
                </div>
                <div
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getDifficultyColor(wallet.difficulty)}`}
                >
                  {wallet.difficulty.charAt(0).toUpperCase() + wallet.difficulty.slice(1)}
                </div>
              </div>
            </div>
            <ChevronRight
              className={`w-5 h-5 transition-transform ${isSelected ? 'rotate-90 text-fg-primary' : 'text-fg-tertiary'}`}
            />
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <CardDescription className="mb-4">{wallet.description}</CardDescription>
          <div className="flex flex-wrap gap-2 mb-4">
            {wallet.features.map(feature => (
              <span
                key={feature}
                className="px-2 py-1 bg-surface-raised text-fg-primary rounded-full text-xs"
              >
                {feature}
              </span>
            ))}
          </div>
          <div className="text-sm text-fg-secondary">
            <strong>Platforms:</strong> {wallet.supportedPlatforms.join(', ')}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

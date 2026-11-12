/**
 * CONFIGURE STEP COMPONENT
 * Fifth step - configure preferences (tier, auto-router)
 */

import { Zap, Lightbulb, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { MODEL_TIERS, TIER_CONFIG, type ModelTier } from '@/config/ai-models';
import { aiOnboardingContent, tierDescriptions } from '@/lib/ai-guidance';

interface ConfigureStepProps {
  selectedTier: ModelTier;
  autoRouterEnabled: boolean;
  onTierChange: (tier: ModelTier) => void;
  onAutoRouterChange: (enabled: boolean) => void;
}

export function ConfigureStep({
  selectedTier,
  autoRouterEnabled,
  onTierChange,
  onAutoRouterChange,
}: ConfigureStepProps) {
  return (
    <div className="space-y-6">
      {/* Auto Router Toggle */}
      <Card className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface-raised flex items-center justify-center">
              <Zap className="w-5 h-5 text-fg-primary" />
            </div>
            <div>
              <h3 className="font-medium">Auto Router</h3>
              <p className="text-sm text-fg-secondary">
                Automatically selects the best model based on message complexity
              </p>
            </div>
          </div>
          <Switch
            checked={autoRouterEnabled}
            onCheckedChange={onAutoRouterChange}
            aria-label="Auto Router"
          />
        </div>
        {autoRouterEnabled && (
          <div className="mt-3 p-3 bg-surface-raised/40 rounded-lg">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-fg-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-fg-primary">
                Simple messages use cheaper models. Complex tasks use more powerful ones. Saves
                money without sacrificing quality.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Default Tier Selection */}
      <div>
        <label className="block text-sm font-medium text-fg-primary mb-2">
          Default Tier
          {autoRouterEnabled && (
            <span className="text-fg-secondary font-normal ml-2">
              (fallback when auto-router is uncertain)
            </span>
          )}
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MODEL_TIERS.map(tier => {
            const config = TIER_CONFIG[tier];
            const tierInfo = tierDescriptions[tier];
            const isSelected = selectedTier === tier;

            return (
              <button
                key={tier}
                type="button"
                onClick={() => onTierChange(tier)}
                className={cn(
                  'p-4 rounded-lg border-2 text-left transition-all',
                  isSelected
                    ? 'border-fg-primary bg-surface-raised/40'
                    : 'border-default hover:border-strong dark:hover:border-default'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{config.label}</span>
                  {config.badge && (
                    <Badge className={`${config.badgeClass} text-xs px-1.5 py-0`}>
                      {config.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-fg-secondary">{tierInfo?.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tier Details */}
      {selectedTier && tierDescriptions[selectedTier] && (
        <Card className="p-4 bg-surface-raised">
          <h4 className="font-medium mb-2">{tierDescriptions[selectedTier].title}</h4>
          <p className="text-sm text-fg-secondary mb-3">
            Best for: {tierDescriptions[selectedTier].bestFor}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tierDescriptions[selectedTier].models.map(model => (
              <Badge key={model} variant="outline" className="text-xs">
                {model}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Tips */}
      <div className="bg-surface-raised/40 border border-subtle rounded-lg p-4">
        <h4 className="font-semibold text-fg-primary mb-2 flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          Tips
        </h4>
        <ul className="space-y-1">
          {aiOnboardingContent.configure.tips?.map((tip, index) => (
            <li key={index} className="text-sm text-fg-primary flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

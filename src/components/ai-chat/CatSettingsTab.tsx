/**
 * Cat Settings Tab — what's actually controllable for this user.
 *
 * Honest layout (no decorative tier picker): show the real state of
 * the user's Cat — their tier + remaining quota, key status, and the
 * permissions they grant the agent. Anything the user can't actually
 * act on (e.g. picking a paid model without a key) doesn't render.
 */

'use client';

import Link from 'next/link';
import { useAISettings } from '@/hooks/useAISettings';
import { useCatPermissions } from '@/hooks/useCatPermissions';
import { useCatQuota } from './ModernChatPanel/hooks/useCatQuota';
import {
  Key,
  Shield,
  ShieldAlert,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Check,
  ArrowUpRight,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { ROUTES } from '@/config/routes';
import { CAT_UPSELL } from '@/config/cat-plans';
import { CatConnectionsPanel } from './CatConnectionsPanel';

export function CatSettingsTab() {
  const { hasByok } = useAISettings();
  const {
    permissions,
    isLoading: permLoading,
    isSaving: saving,
    toggleCategory,
  } = useCatPermissions();
  const { quota } = useCatQuota();

  return (
    <div className="space-y-6">
      <CatConnectionsPanel />

      {/* What you're on right now */}
      <div className="overflow-hidden rounded-md border border-subtle bg-surface-page">
        <div className="flex items-center gap-2 border-b border-subtle bg-surface-raised/50 px-4 py-3">
          <Key className="h-4 w-4 text-fg-secondary" />
          <span className="text-sm font-semibold text-fg-primary">Your Cat plan</span>
        </div>
        <div className="space-y-3 p-4">
          {hasByok ? (
            <div className="flex items-center gap-3 rounded-md border border-status-positive/20 bg-status-positive-subtle p-3">
              <div className="rounded-md bg-surface-page p-2">
                <Check className="h-4 w-4 text-status-positive" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-fg-primary">Your key — no platform cap</p>
                <p className="text-xs text-fg-secondary">
                  Cat routes every request through your provider. You pay your provider directly.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-md border border-subtle bg-surface-raised p-3">
              <div className="rounded-md bg-surface-page p-2">
                <AlertTriangle className="h-4 w-4 text-fg-secondary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-fg-primary">
                  Free —{' '}
                  {quota
                    ? `${quota.requestsRemaining} / ${quota.dailyLimit} messages left today`
                    : 'platform key, daily cap'}
                </p>
                <p className="text-xs text-fg-secondary">
                  {CAT_UPSELL.byokShort} — or see the plans for more ways to run Cat.
                </p>
              </div>
            </div>
          )}
          <Link
            href={ROUTES.SETTINGS_AI}
            className="flex min-h-11 items-center justify-between rounded-md border border-subtle bg-surface-page px-3 py-2 transition-colors hover:bg-surface-raised"
          >
            <span className="text-sm text-fg-primary">
              {hasByok ? 'Manage your API keys' : 'Add a free Groq key'}
            </span>
            <ChevronRight className="h-4 w-4 text-fg-tertiary" />
          </Link>
          {!hasByok && (
            <Link
              href={ROUTES.PRICING}
              className="flex min-h-11 items-center justify-between rounded-md border border-accent-warm/30 bg-accent-warm/10 px-3 py-2 transition-colors hover:bg-accent-warm/20"
            >
              <span className="text-sm font-medium text-fg-primary">See Cat plans</span>
              <ArrowUpRight className="h-4 w-4 text-accent-warm" />
            </Link>
          )}
        </div>
      </div>

      {/* Permissions */}
      <div className="overflow-hidden rounded-md border border-subtle bg-surface-page">
        <div className="flex items-center justify-between border-b border-subtle bg-surface-raised/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-fg-secondary" />
            <span className="text-sm font-semibold text-fg-primary">Permissions</span>
          </div>
          {permissions && (
            <span className="text-xs text-fg-secondary">
              {permissions.summary.enabledActions}/{permissions.summary.totalActions} enabled
            </span>
          )}
        </div>

        {permLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-fg-tertiary" />
          </div>
        ) : permissions ? (
          <div className="divide-y divide-fg-tertiary">
            {permissions.summary.categories.map(cat => {
              const isSaving = saving === cat.category;
              return (
                <div key={cat.category} className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg-primary">{cat.name}</p>
                    <p className="text-sm text-fg-secondary truncate">{cat.description}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin text-fg-tertiary" />}
                    <Switch
                      checked={cat.enabled}
                      onCheckedChange={checked => toggleCategory(cat.category, checked)}
                      disabled={isSaving}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 text-center text-sm text-fg-secondary">
            Failed to load permissions
          </div>
        )}

        {permissions?.summary.highRiskEnabled && (
          <div className="flex items-center gap-2 border-t border-status-negative/20 bg-status-negative/10 px-4 py-3">
            <ShieldAlert className="h-4 w-4 text-status-negative" />
            <span className="text-xs text-status-negative">High-risk actions enabled</span>
          </div>
        )}
      </div>

      {/* Link to full settings */}
      <Link
        href={ROUTES.SETTINGS_AI}
        className="block py-2 text-center text-sm text-fg-secondary hover:text-fg-primary"
      >
        View all AI settings
      </Link>
    </div>
  );
}

export default CatSettingsTab;

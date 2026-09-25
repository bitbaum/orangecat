'use client';

/**
 * WHAT CAT CAN DO — the one place permissions, spending caps and Cat's own
 * record live.
 *
 * Order is the order of the questions a person asks: how much may it do on
 * its own (presets), what exactly (categories, with the payment caps right
 * under payments), and what has it actually done (track record, activity).
 */

import { AlertTriangle, Loader2 } from 'lucide-react';
import { catPermissionAnchorId } from '@/config/routes';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { CatTrackRecordCard } from '@/components/ai-chat/CatTrackRecordCard';
import { CategoryRow } from './permissions/CategoryRow';
import { SpendCapsCard } from './permissions/SpendCapsCard';
import { PermissionPresets } from './permissions/PermissionPresets';
import { PermissionInfo } from './permissions/PermissionInfo';
import { CatActivityCard } from './permissions/CatActivityCard';
import { useCatPermissionsData } from './permissions/useCatPermissionsData';

export function CanDoSection({ userId }: { userId: string }) {
  const p = useCatPermissionsData(true);

  if (p.loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-fg-tertiary" />
      </div>
    );
  }
  if (p.error || !p.data) {
    return (
      <p className="rounded-md border border-subtle p-4 text-sm text-fg-secondary">
        {p.error ?? 'Couldn’t load what Cat may do.'} Try again in a moment.
      </p>
    );
  }

  const { summary, availableActions, spendCaps } = p.data;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <PermissionPresets
          categories={summary.categories}
          saving={p.saving}
          onToggleCategory={p.toggleCategory}
        />

        {summary.highRiskEnabled && (
          <p className="flex items-start gap-2 rounded-md border border-subtle bg-status-warning-subtle px-4 py-3 text-sm text-fg-primary">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-status-warning" />
            Cat may send Bitcoin or post publicly — it always asks you first.
          </p>
        )}

        <div className="space-y-3">
          {summary.categories.map(cat => (
            // The anchor an AI failure notice deep-links to (@/config/ai-errors).
            <div
              key={cat.category}
              id={catPermissionAnchorId(cat.category)}
              className="scroll-mt-28 space-y-3"
            >
              <CategoryRow
                cat={cat}
                actions={availableActions.filter(a => a.category === cat.category)}
                isExpanded={p.expanded.has(cat.category)}
                saving={p.saving}
                onToggleExpanded={p.toggleExpanded}
                onToggleCategory={p.toggleCategory}
                onSetAutonomy={p.setActionAutonomy}
              />
              {cat.category === 'payments' && cat.enabled && (
                <SpendCapsCard
                  caps={spendCaps}
                  disabled={p.saving !== null}
                  onSaved={caps => p.setData(prev => (prev ? { ...prev, spendCaps: caps } : prev))}
                />
              )}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-fg-primary">What Cat has done</h3>
          <CatTrackRecordCard />
          <CatActivityCard userId={userId} />
        </div>

        <PermissionInfo />
      </div>
    </TooltipProvider>
  );
}

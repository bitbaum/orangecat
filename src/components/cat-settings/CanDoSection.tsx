'use client';

/**
 * WHAT CAT CAN DO — the one place permissions, spending caps and Cat's own
 * record live.
 *
 * Order is the order of the questions a person asks: how much may it do on
 * its own (presets), what exactly (categories, with the payment caps right
 * under payments), and what has it actually done (track record, activity).
 */

import { useState } from 'react';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { catPermissionAnchorId } from '@/config/routes';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { CatTrackRecordCard } from '@/components/ai-chat/CatTrackRecordCard';
import { CategoryRow } from './permissions/CategoryRow';
import { SpendCapsCard } from './permissions/SpendCapsCard';
import { PermissionPresets } from './permissions/PermissionPresets';
import { PermissionInfo } from './permissions/PermissionInfo';
import { CatActivityCard } from './permissions/CatActivityCard';
import { useCatPermissionsData } from './permissions/useCatPermissionsData';
import { activePreset, highRiskNotice, needsConfirmToTurnOn } from './permissions/permission-view';

export function CanDoSection({ userId }: { userId: string }) {
  const p = useCatPermissionsData(true);
  const [confirmCategory, setConfirmCategory] = useState<string | null>(null);

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
  const notice = highRiskNotice(availableActions);
  const actionsIn = (category: string) => availableActions.filter(a => a.category === category);
  const confirming = summary.categories.find(c => c.category === confirmCategory);

  // Turning on a whole category that spends Bitcoin asks first; off never does.
  const toggleCategory = (category: string, on: boolean) => {
    if (needsConfirmToTurnOn(actionsIn(category), on)) {
      setConfirmCategory(category);
      return;
    }
    void p.toggleCategory(category, on);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <PermissionPresets
          saving={p.saving}
          active={activePreset(summary.categories)}
          onApplyPreset={p.applyPreset}
        />

        {notice?.tone === 'warning' && (
          <p className="mb-0 flex items-start gap-2 rounded-md border border-subtle bg-status-warning-subtle px-4 py-3 text-sm text-fg-primary">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-status-warning" />
            {notice.text}
          </p>
        )}
        {notice?.tone === 'neutral' && (
          <p className="mb-0 flex items-start gap-2 rounded-md border border-subtle px-4 py-3 text-sm text-fg-secondary">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-fg-tertiary" />
            {notice.text}
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
                actions={actionsIn(cat.category)}
                isExpanded={p.expanded.has(cat.category)}
                saving={p.saving}
                onToggleExpanded={p.toggleExpanded}
                onToggleCategory={toggleCategory}
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

        <ConfirmDialog
          isOpen={confirming !== undefined}
          onClose={() => setConfirmCategory(null)}
          onConfirm={async () => {
            const category = confirmCategory;
            setConfirmCategory(null);
            if (category) {
              await p.toggleCategory(category, true);
            }
          }}
          title={
            confirming
              ? `Turn on all ${confirming.actionCount} ${confirming.name.toLowerCase()} actions?`
              : ''
          }
          description="Cat still asks before every payment."
          confirmLabel="Turn them on"
          isLoading={p.saving === confirmCategory}
        />
      </div>
    </TooltipProvider>
  );
}

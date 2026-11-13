'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { RISK_COLORS, RISK_ICONS } from '@/config/cat-actions';
import { AUTONOMY_LEVEL_META, type AutonomyLevel } from '@/config/cat-autonomy';
import { AutonomySelect } from './AutonomySelect';
import { categoryCountLabel, categoryDetail } from './permission-view';
import type { Action, CategorySummary } from './types';

interface ActionRowProps {
  action: Action;
  isSaving: boolean;
  isAnySaving: boolean;
  onSetAutonomy: (actionId: string, category: string, level: AutonomyLevel) => void;
}

function ActionRow({ action, isSaving, isAnySaving, onSetAutonomy }: ActionRowProps) {
  const RiskIcon = RISK_ICONS[action.riskLevel];

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface-base p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Tooltip>
          <TooltipTrigger>
            <div className={`rounded p-1.5 ${RISK_COLORS[action.riskLevel]}`}>
              <RiskIcon className="h-4 w-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="capitalize">{action.riskLevel} risk</p>
          </TooltipContent>
        </Tooltip>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-fg-primary">{action.name}</span>
            {action.riskLevel === 'high' && (
              <Badge variant="outline" className="text-xs">
                Always confirms
              </Badge>
            )}
          </div>
          <p className="mb-0 break-words text-sm text-fg-secondary">{action.description}</p>
          <p className="mb-0 mt-0.5 text-xs text-fg-tertiary">
            {AUTONOMY_LEVEL_META[action.autonomy].description}
          </p>
        </div>
      </div>
      <div className="flex-shrink-0">
        <AutonomySelect
          value={action.autonomy}
          riskLevel={action.riskLevel}
          disabled={isSaving || isAnySaving}
          ariaLabel={`Autonomy level for ${action.name}`}
          onChange={level => onSetAutonomy(action.id, action.category, level)}
        />
      </div>
    </div>
  );
}

interface CategoryRowProps {
  cat: CategorySummary;
  actions: Action[];
  isExpanded: boolean;
  saving: string | null;
  onToggleExpanded: (id: string) => void;
  onToggleCategory: (id: string, enabled: boolean) => void;
  onSetAutonomy: (actionId: string, category: string, level: AutonomyLevel) => void;
}

export function CategoryRow({
  cat,
  actions,
  isExpanded,
  saving,
  onToggleExpanded,
  onToggleCategory,
  onSetAutonomy,
}: CategoryRowProps) {
  const panelId = `cat-category-${cat.category}-actions`;
  return (
    <div className="bg-surface-base rounded-lg border border-default overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <button
            type="button"
            onClick={() => onToggleExpanded(cat.category)}
            aria-expanded={isExpanded}
            aria-controls={panelId}
            aria-label={`${isExpanded ? 'Hide' : 'Show'} ${cat.name} actions`}
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-surface-raised"
          >
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-fg-tertiary" />
            ) : (
              <ChevronRight className="h-5 w-5 text-fg-tertiary" />
            )}
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h3 className="text-base font-semibold text-fg-primary">{cat.name}</h3>
              <span className="text-sm text-fg-secondary">{categoryCountLabel(cat)}</span>
            </div>
            <p className="mb-0 text-sm text-fg-secondary">{categoryDetail(cat, actions)}</p>
          </div>
        </div>
        <Switch
          checked={cat.enabled}
          onCheckedChange={checked => onToggleCategory(cat.category, checked)}
          disabled={saving === cat.category}
          aria-label={`Allow ${cat.name}`}
        />
      </div>

      {isExpanded && (
        <div id={panelId} className="border-t border-subtle bg-surface-raised p-4">
          <div className="space-y-3">
            {actions.map(action => (
              <ActionRow
                key={action.id}
                action={action}
                isSaving={saving === action.id}
                isAnySaving={saving === cat.category}
                onSetAutonomy={onSetAutonomy}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

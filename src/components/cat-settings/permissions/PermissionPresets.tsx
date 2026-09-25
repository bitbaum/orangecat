'use client';

import { Shield, ShieldCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { CategorySummary } from './types';

interface PermissionPresetsProps {
  categories: CategorySummary[];
  saving: string | null;
  onToggleCategory: (id: string, enabled: boolean) => void;
}

export function PermissionPresets({
  categories,
  saving,
  onToggleCategory,
}: PermissionPresetsProps) {
  const applyPreset = (shouldEnable: (categoryId: string) => boolean) => {
    categories.forEach(cat => {
      const wanted = shouldEnable(cat.category);
      if (wanted !== cat.enabled) {
        onToggleCategory(cat.category, wanted);
      }
    });
  };

  return (
    <div className="mt-8">
      <h3 className="mb-3 text-base font-semibold text-fg-primary">Quick presets</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => applyPreset(id => id === 'context')}
          disabled={saving !== null}
          className="rounded-md border border-subtle p-4 text-left transition-colors hover:border-strong hover:bg-surface-raised disabled:opacity-50"
        >
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-5 w-5 text-status-positive" />
            <span className="font-medium text-fg-primary">Minimal</span>
          </div>
          <p className="text-sm text-fg-secondary">
            Only context management. Safest option for new users.
          </p>
        </button>

        <button
          onClick={() => applyPreset(id => ['entities', 'context', 'communication'].includes(id))}
          disabled={saving !== null}
          className="rounded-md border border-subtle p-4 text-left transition-colors hover:border-strong hover:bg-surface-raised disabled:opacity-50"
        >
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-5 w-5 text-fg-primary" />
            <span className="font-medium text-fg-primary">Creator</span>
          </div>
          <p className="text-sm text-fg-secondary">
            Create content & communicate. Best for most users.
          </p>
        </button>

        <button
          onClick={() => applyPreset(id => id !== 'payments')}
          disabled={saving !== null}
          className="rounded-md border border-subtle p-4 text-left transition-colors hover:border-strong hover:bg-surface-raised disabled:opacity-50"
        >
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-5 w-5 text-status-warning" />
            <span className="font-medium text-fg-primary">Power User</span>
          </div>
          <p className="text-sm text-fg-secondary">
            Everything except payments. For experienced users.
          </p>
        </button>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => applyPreset(() => false)}
          disabled={saving !== null}
          className="text-fg-secondary hover:text-status-negative"
        >
          Disable All Permissions
        </Button>
      </div>
    </div>
  );
}

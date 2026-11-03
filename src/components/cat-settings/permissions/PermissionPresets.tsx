'use client';

import { Shield, ShieldCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { PermissionPreset } from '@/config/cat-autonomy';

interface PermissionPresetsProps {
  saving: string | null;
  onApplyPreset: (preset: PermissionPreset) => void;
}

export function PermissionPresets({ saving, onApplyPreset }: PermissionPresetsProps) {
  return (
    <div className="mt-8">
      <h3 className="mb-3 text-base font-semibold text-fg-primary">Quick presets</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => onApplyPreset('minimal')}
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
          onClick={() => onApplyPreset('creator')}
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
          onClick={() => onApplyPreset('power')}
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
          onClick={() => onApplyPreset('none')}
          disabled={saving !== null}
          className="text-fg-secondary hover:text-status-negative"
        >
          Disable All Permissions
        </Button>
      </div>
    </div>
  );
}

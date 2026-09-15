'use client';

/**
 * Single integration-key list row. Lifted out of IntegrationKeysCard
 * 2026-06-04 to keep the parent under the 300-line component cap.
 *
 * Pure presentation; rotate + revoke handlers come from the parent so
 * post-action state updates (revoked_at flip, list prepend on rotate)
 * stay in one place.
 */

import { RotateCcw, Trash2 } from 'lucide-react';
import type { IntegrationKey } from '@/components/settings/IntegrationKeysCard';
import { formatOptionalDateTime } from '@/utils/locale';

interface Props {
  integrationKey: IntegrationKey;
  actorLabel: string;
  onRotate: (key: IntegrationKey) => void;
  onRevoke: (key: IntegrationKey) => void;
}

export default function IntegrationKeyRow({
  integrationKey: key,
  actorLabel,
  onRotate,
  onRevoke,
}: Props) {
  const isRevoked = !!key.revoked_at;

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-fg-primary">{key.name}</span>
          {key.is_test && (
            <span className="rounded bg-status-warning-subtle px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-status-warning">
              Sandbox
            </span>
          )}
          {isRevoked && (
            <span className="rounded bg-surface-raised px-1.5 py-0.5 text-2xs uppercase tracking-wide text-fg-secondary">
              Revoked
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-fg-secondary">
          <span>
            <code className="rounded bg-surface-raised px-1">{key.key_prefix}…</code>
          </span>
          <span>Acts as {actorLabel}</span>
          <span>
            Scopes:{' '}
            <code className="rounded bg-surface-raised px-1">
              {(key.scopes ?? ['*']).join(', ')}
            </code>
          </span>
          <span>Created {formatOptionalDateTime(key.created_at)}</span>
          <span>Last used {formatOptionalDateTime(key.last_used_at)}</span>
        </div>
      </div>
      {!isRevoked && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onRotate(key)}
            className="inline-flex items-center gap-1 rounded-md border border-subtle px-2.5 py-1.5 text-xs text-fg-secondary hover:bg-surface-raised/60 hover:text-fg-primary"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Rotate
          </button>
          <button
            type="button"
            onClick={() => onRevoke(key)}
            className="inline-flex items-center gap-1 rounded-md border border-subtle px-2.5 py-1.5 text-xs text-fg-secondary hover:bg-surface-raised/60 hover:text-status-negative"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Revoke
          </button>
        </div>
      )}
    </li>
  );
}

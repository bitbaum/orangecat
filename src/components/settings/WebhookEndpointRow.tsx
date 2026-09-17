'use client';

/**
 * Single webhook-endpoint list row with inline deliveries drawer toggle.
 * Lifted out of WebhookEndpointsCard 2026-06-04 to keep the parent
 * under the 300-line component cap.
 *
 * Pure presentation; expansion state + revoke handler come from the
 * parent so single-expanded-at-a-time and the post-revoke list update
 * stay in one place.
 */

import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import WebhookDeliveriesDrawer from '@/components/settings/WebhookDeliveriesDrawer';
import { FormattedDate } from '@/components/ui/FormattedDate';

export interface WebhookEndpoint {
  id: string;
  actor_id: string;
  name: string;
  url: string;
  secret_prefix: string;
  event_types: string[] | null;
  created_at: string;
  last_delivery_at: string | null;
  revoked_at: string | null;
}

interface Props {
  endpoint: WebhookEndpoint;
  actorLabel: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRevoke: (endpoint: WebhookEndpoint) => void;
}

export default function WebhookEndpointRow({
  endpoint,
  actorLabel,
  isExpanded,
  onToggleExpand,
  onRevoke,
}: Props) {
  const isRevoked = !!endpoint.revoked_at;

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-fg-primary">{endpoint.name}</span>
            {isRevoked && (
              <span className="rounded bg-surface-raised px-1.5 py-0.5 text-2xs uppercase tracking-wide text-fg-secondary">
                Revoked
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-fg-secondary">
            <span className="truncate max-w-full sm:max-w-xs">
              <code className="rounded bg-surface-raised px-1">{endpoint.url}</code>
            </span>
            <span>Acts as {actorLabel}</span>
            <span>
              Events:{' '}
              <code className="rounded bg-surface-raised px-1">
                {endpoint.event_types && endpoint.event_types.length > 0
                  ? endpoint.event_types.join(', ')
                  : 'all'}
              </code>
            </span>
            <span>
              Created <FormattedDate value={endpoint.created_at} mode="datetime" />
            </span>
            <span>
              Last delivery <FormattedDate value={endpoint.last_delivery_at} mode="datetime" />
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleExpand}
            className="inline-flex items-center gap-1 rounded-md border border-subtle px-2.5 py-1.5 text-xs text-fg-secondary hover:bg-surface-raised/60 hover:text-fg-primary"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Deliveries
          </button>
          {!isRevoked && (
            <button
              type="button"
              onClick={() => onRevoke(endpoint)}
              className="inline-flex items-center gap-1 rounded-md border border-subtle px-2.5 py-1.5 text-xs text-fg-secondary hover:bg-surface-raised/60 hover:text-status-negative"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Revoke
            </button>
          )}
        </div>
      </div>
      {isExpanded && <WebhookDeliveriesDrawer endpointId={endpoint.id} />}
    </li>
  );
}

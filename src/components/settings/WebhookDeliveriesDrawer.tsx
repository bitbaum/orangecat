'use client';

/**
 * Inline deliveries drawer rendered below a webhook endpoint row when
 * the user clicks "Deliveries". Fetches lazily on first open, exposes
 * a manual refresh button, and shows status + attempt count + response
 * status + timestamps so the operator can diagnose without leaving
 * /settings/integrations.
 *
 * Not real-time. Auto-refresh is intentionally out of scope here —
 * webhook delivery is the kind of thing operators reach for during
 * incident response, not steady-state monitoring.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  RefreshCw,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { API_ROUTES } from '@/config/api-routes';
import { logger } from '@/utils/logger';
import { FormattedDate } from '@/components/ui/FormattedDate';

interface DeliveryRow {
  id: string;
  endpoint_id: string;
  event_type: string;
  event_id: string;
  payload: unknown;
  status: 'pending' | 'delivered' | 'failed';
  response_status: number | null;
  response_body: string | null;
  attempt_count: number;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  created_at: string;
}

interface Props {
  endpointId: string;
}

function StatusBadge({ status }: { status: DeliveryRow['status'] }) {
  if (status === 'delivered') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-status-positive-subtle px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-status-positive">
        <CheckCircle2 className="h-3 w-3" />
        Delivered
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-status-negative/10 px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-status-negative">
        <XCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-surface-raised px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-fg-secondary">
      <Clock className="h-3 w-3" />
      Pending
    </span>
  );
}

function prettyPrintPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export default function WebhookDeliveriesDrawer({ endpointId }: Props) {
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const load = useCallback(async () => {
    cancelRef.current = false;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.WEBHOOK_ENDPOINTS.DELIVERIES(endpointId), {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to load deliveries (${res.status})`);
      }
      const json = (await res.json()) as { data: { deliveries: DeliveryRow[] } };
      if (!cancelRef.current) {
        setDeliveries(json.data?.deliveries ?? []);
      }
    } catch (err) {
      logger.error('Failed to load webhook deliveries', { err });
      if (!cancelRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load deliveries');
      }
    } finally {
      if (!cancelRef.current) {
        setLoading(false);
      }
    }
  }, [endpointId]);

  const handleReplay = useCallback(
    async (deliveryId: string) => {
      setReplayingId(deliveryId);
      setError(null);
      try {
        const res = await fetch(
          API_ROUTES.WEBHOOK_ENDPOINTS.DELIVERY_REPLAY(endpointId, deliveryId),
          { method: 'POST', credentials: 'include' }
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || `Failed to replay (${res.status})`);
        }
        // Reload — the row's status, attempt_count, next_attempt_at all
        // changed and the worker may already have moved it.
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to replay');
      } finally {
        setReplayingId(null);
      }
    },
    [endpointId, load]
  );

  useEffect(() => {
    load();
    return () => {
      cancelRef.current = true;
    };
  }, [load]);

  return (
    <div className="mt-3 rounded-md border border-subtle bg-surface-raised/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-medium text-fg-primary">Recent deliveries</h4>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-subtle px-2 py-1 text-[11px] text-fg-secondary hover:bg-surface-raised/60 hover:text-fg-primary disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-2 rounded border border-status-negative/30 bg-status-negative/5 px-2 py-1 text-xs text-status-negative">
          {error}
        </div>
      )}

      {loading && deliveries.length === 0 ? (
        <p className="text-xs text-fg-secondary">Loading…</p>
      ) : deliveries.length === 0 ? (
        <p className="text-xs text-fg-secondary">
          No deliveries yet. The next entity create on this actor will fire here.
        </p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {deliveries.map(d => {
            const isExpanded = expandedId === d.id;
            return (
              <li key={d.id} className="py-2 text-xs">
                <button
                  type="button"
                  onClick={() => setExpandedId(prev => (prev === d.id ? null : d.id))}
                  className="flex w-full items-start gap-2 text-left hover:bg-surface-raised/30 rounded-sm px-1 -mx-1 py-0.5"
                >
                  <span className="mt-0.5 text-fg-secondary">
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={d.status} />
                      <code className="rounded bg-surface-raised px-1 text-2xs">
                        {d.event_type}
                      </code>
                      {d.response_status !== null && (
                        <span className="text-fg-secondary">HTTP {d.response_status}</span>
                      )}
                      {d.attempt_count > 1 && (
                        <span className="text-fg-secondary">attempt {d.attempt_count}</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-2xs text-fg-secondary">
                      <span>
                        Enqueued <FormattedDate value={d.created_at} mode="datetime" />
                      </span>
                      <span>
                        Last attempt <FormattedDate value={d.last_attempt_at} mode="datetime" />
                      </span>
                      {d.status === 'pending' && d.next_attempt_at && (
                        <span>
                          Next retry <FormattedDate value={d.next_attempt_at} mode="datetime" />
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                {isExpanded && (
                  <div className="mt-2 ml-5 space-y-2">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleReplay(d.id)}
                        disabled={replayingId === d.id}
                        className="inline-flex items-center gap-1 rounded-md border border-subtle px-2 py-1 text-[11px] text-fg-secondary hover:bg-surface-raised/60 hover:text-fg-primary disabled:opacity-50"
                      >
                        <RotateCcw
                          className={`h-3 w-3 ${replayingId === d.id ? 'animate-spin' : ''}`}
                        />
                        {replayingId === d.id ? 'Replaying…' : 'Replay'}
                      </button>
                    </div>
                    <div>
                      <div className="mb-1 text-2xs uppercase tracking-wide text-fg-secondary">
                        Sent payload
                      </div>
                      <pre className="max-h-64 overflow-auto rounded border border-subtle bg-surface-page p-2 text-2xs leading-snug text-fg-primary">
                        {prettyPrintPayload(d.payload)}
                      </pre>
                    </div>
                    {d.response_body && (
                      <div>
                        <div className="mb-1 text-2xs uppercase tracking-wide text-fg-secondary">
                          Receiver response
                        </div>
                        <pre className="max-h-32 overflow-auto rounded border border-subtle bg-surface-page p-2 text-2xs leading-snug text-fg-primary">
                          {d.response_body}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

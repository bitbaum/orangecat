'use client';

/**
 * Webhook endpoints panel — orchestrates mint, list, revoke, deliveries
 * drawer toggle.
 *
 * Same UX as IntegrationKeysCard (sibling on /settings/integrations).
 * Endpoints receive signed POSTs from OrangeCat when entities the bound
 * actor owns get created — verified by the integration with
 * verifyWebhookSignature from @orangecat/sdk.
 *
 * Lift history:
 *   2026-06-03 — created as a sibling of IntegrationKeysCard.
 *   2026-06-04 — mint form + row + secret reveal extracted into
 *                WebhookEndpointMintForm + WebhookEndpointRow +
 *                shared PlaintextRevealCard. Parent stays under the
 *                300-line component cap with all features intact.
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import WebhookEndpointMintForm from '@/components/settings/WebhookEndpointMintForm';
import WebhookEndpointRow, { type WebhookEndpoint } from '@/components/settings/WebhookEndpointRow';
import PlaintextRevealCard from '@/components/settings/PlaintextRevealCard';
import { API_ROUTES } from '@/config/api-routes';
import { formatOptionalDateTime } from '@/utils/locale';

interface MintResponse {
  data: { endpoint: WebhookEndpoint; secret: string };
}

interface ActorOption {
  actor_id: string;
  label: string;
}

interface Props {
  actors: ActorOption[];
  defaultActorId: string | null;
}

export default function WebhookEndpointsCard({ actors, defaultActorId }: Props) {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedActorId, setSelectedActorId] = useState<string | null>(defaultActorId);
  const [minting, setMinting] = useState(false);
  const [mintedSecret, setMintedSecret] = useState<string | null>(null);
  const [mintedPrefix, setMintedPrefix] = useState<string | null>(null);
  const [expandedEndpointId, setExpandedEndpointId] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());

  function toggleEvent(eventName: string) {
    setSelectedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventName)) {
        next.delete(eventName);
      } else {
        next.add(eventName);
      }
      return next;
    });
  }

  useEffect(() => {
    if (!selectedActorId && defaultActorId) {
      setSelectedActorId(defaultActorId);
    }
  }, [defaultActorId, selectedActorId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(API_ROUTES.WEBHOOK_ENDPOINTS.BASE, { credentials: 'include' });
        if (!res.ok) {
          throw new Error(`Failed to load endpoints (${res.status})`);
        }
        const json = (await res.json()) as { data: { endpoints: WebhookEndpoint[] } };
        if (!cancelled) {
          setEndpoints(json.data?.endpoints ?? []);
          setLoading(false);
        }
      } catch (err) {
        logger.error('Failed to load webhook endpoints', { err });
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load endpoints');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleMint(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedActorId || !name.trim() || !url.trim()) {
      return;
    }
    setMinting(true);
    setError(null);
    try {
      const body: { name: string; url: string; actor_id: string; event_types?: string[] } = {
        name: name.trim(),
        url: url.trim(),
        actor_id: selectedActorId,
      };
      if (selectedEvents.size > 0) {
        body.event_types = Array.from(selectedEvents);
      }
      const res = await fetch(API_ROUTES.WEBHOOK_ENDPOINTS.BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errBody?.error || `Failed to create endpoint (${res.status})`);
      }
      const json = (await res.json()) as MintResponse;
      setMintedSecret(json.data.secret);
      setMintedPrefix(json.data.endpoint.secret_prefix);
      setEndpoints(prev => [json.data.endpoint, ...prev]);
      setName('');
      setUrl('');
      setSelectedEvents(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create endpoint');
    } finally {
      setMinting(false);
    }
  }

  async function handleRevoke(endpoint: WebhookEndpoint) {
    if (!confirm(`Revoke "${endpoint.name}"? Deliveries to this URL will stop immediately.`)) {
      return;
    }
    try {
      const res = await fetch(API_ROUTES.WEBHOOK_ENDPOINTS.BY_ID(endpoint.id), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to revoke (${res.status})`);
      }
      setEndpoints(prev =>
        prev.map(e => (e.id === endpoint.id ? { ...e, revoked_at: new Date().toISOString() } : e))
      );
      toast.success('Webhook endpoint revoked');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke endpoint');
    }
  }

  return (
    <section className="space-y-4">
      {error && (
        <div className="rounded-md border border-status-negative/30 bg-status-negative/5 px-3 py-2 text-sm text-status-negative">
          {error}
        </div>
      )}

      <WebhookEndpointMintForm
        actors={actors}
        name={name}
        onNameChange={setName}
        url={url}
        onUrlChange={setUrl}
        selectedActorId={selectedActorId}
        onActorChange={setSelectedActorId}
        selectedEvents={selectedEvents}
        onToggleEvent={toggleEvent}
        minting={minting}
        onSubmit={handleMint}
      />

      {mintedSecret && mintedPrefix && (
        <PlaintextRevealCard
          plaintext={mintedSecret}
          prefix={mintedPrefix}
          label="signing secret"
          onDismiss={() => {
            setMintedSecret(null);
            setMintedPrefix(null);
          }}
        />
      )}

      <div className="rounded-lg border border-subtle">
        <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
          <h3 className="text-sm font-medium text-fg-primary">Your endpoints</h3>
          <span className="text-xs text-fg-secondary">
            {endpoints.length} {endpoints.length === 1 ? 'endpoint' : 'endpoints'}
          </span>
        </div>
        {loading ? (
          <div className="p-4 text-sm text-fg-secondary">Loading…</div>
        ) : endpoints.length === 0 ? (
          <div className="p-6 text-center text-sm text-fg-secondary">
            No endpoints yet. Create one above to receive signed events.
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {endpoints.map(endpoint => (
              <WebhookEndpointRow
                key={endpoint.id}
                endpoint={endpoint}
                actorLabel={
                  actors.find(a => a.actor_id === endpoint.actor_id)?.label ?? endpoint.actor_id
                }
                isExpanded={expandedEndpointId === endpoint.id}
                onToggleExpand={() =>
                  setExpandedEndpointId(prev => (prev === endpoint.id ? null : endpoint.id))
                }
                onRevoke={handleRevoke}
                formatTimestamp={formatOptionalDateTime}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

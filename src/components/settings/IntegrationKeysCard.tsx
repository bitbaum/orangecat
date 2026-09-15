'use client';

/**
 * Integration keys panel — orchestrates mint, list, revoke, rotate.
 *
 * Lift history:
 *   2026-06-03 — extracted from /settings/integrations/page.tsx so the
 *                page could grow a sibling webhook-endpoints panel.
 *   2026-06-04 — mint form + plaintext reveal card extracted into
 *                IntegrationKeyMintForm + PlaintextRevealCard to keep
 *                this file under the 300-line component cap.
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import IntegrationKeyMintForm from '@/components/settings/IntegrationKeyMintForm';
import IntegrationKeyRow from '@/components/settings/IntegrationKeyRow';
import PlaintextRevealCard from '@/components/settings/PlaintextRevealCard';
import { API_ROUTES } from '@/config/api-routes';
import { formatOptionalDateTime } from '@/utils/locale';

export interface IntegrationKey {
  id: string;
  actor_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_test: boolean;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

interface MintResponse {
  data: { key: IntegrationKey; plaintext: string };
}

interface ActorOption {
  actor_id: string;
  label: string;
}

interface Props {
  actors: ActorOption[];
  defaultActorId: string | null;
}

export default function IntegrationKeysCard({ actors, defaultActorId }: Props) {
  const [keys, setKeys] = useState<IntegrationKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selectedActorId, setSelectedActorId] = useState<string | null>(defaultActorId);
  const [restrictPermissions, setRestrictPermissions] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [isTest, setIsTest] = useState(false);
  const [minting, setMinting] = useState(false);
  const [mintedPlaintext, setMintedPlaintext] = useState<string | null>(null);
  const [mintedPrefix, setMintedPrefix] = useState<string | null>(null);

  function toggleScope(token: string) {
    setSelectedScopes(prev => {
      const next = new Set(prev);
      if (next.has(token)) {
        next.delete(token);
      } else {
        next.add(token);
      }
      return next;
    });
  }

  function clearScopes() {
    setSelectedScopes(new Set());
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
        const res = await fetch(API_ROUTES.INTEGRATION_KEYS.BASE, { credentials: 'include' });
        if (!res.ok) {
          throw new Error(`Failed to load keys (${res.status})`);
        }
        const json = (await res.json()) as { data: { keys: IntegrationKey[] } };
        if (!cancelled) {
          setKeys(json.data?.keys ?? []);
          setLoading(false);
        }
      } catch (err) {
        logger.error('Failed to load integration keys', { err });
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load keys');
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
    if (!selectedActorId || !name.trim()) {
      return;
    }
    if (restrictPermissions && selectedScopes.size === 0) {
      setError('Pick at least one scope, or switch back to full access.');
      return;
    }
    setMinting(true);
    setError(null);
    try {
      const body: { name: string; actor_id: string; scopes?: string[]; is_test?: boolean } = {
        name: name.trim(),
        actor_id: selectedActorId,
      };
      if (restrictPermissions) {
        body.scopes = Array.from(selectedScopes);
      }
      if (isTest) {
        body.is_test = true;
      }
      const res = await fetch(API_ROUTES.INTEGRATION_KEYS.BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errBody?.error || `Failed to mint key (${res.status})`);
      }
      const json = (await res.json()) as MintResponse;
      setMintedPlaintext(json.data.plaintext);
      setMintedPrefix(json.data.key.key_prefix);
      setKeys(prev => [json.data.key, ...prev]);
      setName('');
      setSelectedScopes(new Set());
      setRestrictPermissions(false);
      setIsTest(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mint key');
    } finally {
      setMinting(false);
    }
  }

  async function handleRevoke(key: IntegrationKey) {
    if (!confirm(`Revoke "${key.name}"? Existing integrations will stop working immediately.`)) {
      return;
    }
    try {
      const res = await fetch(API_ROUTES.INTEGRATION_KEYS.BY_ID(key.id), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to revoke (${res.status})`);
      }
      setKeys(prev =>
        prev.map(k => (k.id === key.id ? { ...k, revoked_at: new Date().toISOString() } : k))
      );
      toast.success('Integration key revoked');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke key');
    }
  }

  async function handleRotate(key: IntegrationKey) {
    if (
      !confirm(
        `Rotate "${key.name}"? You'll get a fresh secret; the current one stops working immediately. There is no grace period — swap your env var at the same time.`
      )
    ) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(`${API_ROUTES.INTEGRATION_KEYS.BY_ID(key.id)}/rotate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Failed to rotate (${res.status})`);
      }
      const json = (await res.json()) as MintResponse;
      setMintedPlaintext(json.data.plaintext);
      setMintedPrefix(json.data.key.key_prefix);
      setKeys(prev => [
        json.data.key,
        ...prev.map(k => (k.id === key.id ? { ...k, revoked_at: new Date().toISOString() } : k)),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rotate key');
    }
  }

  return (
    <section className="space-y-4">
      {error && (
        <div className="rounded-md border border-status-negative/30 bg-status-negative/5 px-3 py-2 text-sm text-status-negative">
          {error}
        </div>
      )}

      <IntegrationKeyMintForm
        actors={actors}
        name={name}
        onNameChange={setName}
        selectedActorId={selectedActorId}
        onActorChange={setSelectedActorId}
        isTest={isTest}
        onIsTestChange={setIsTest}
        restrictPermissions={restrictPermissions}
        onRestrictPermissionsChange={setRestrictPermissions}
        selectedScopes={selectedScopes}
        onToggleScope={toggleScope}
        onClearScopes={clearScopes}
        minting={minting}
        onSubmit={handleMint}
      />

      {mintedPlaintext && mintedPrefix && (
        <PlaintextRevealCard
          plaintext={mintedPlaintext}
          prefix={mintedPrefix}
          label="key"
          onDismiss={() => {
            setMintedPlaintext(null);
            setMintedPrefix(null);
          }}
        />
      )}

      <div className="rounded-lg border border-subtle">
        <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
          <h3 className="text-sm font-medium text-fg-primary">Your keys</h3>
          <span className="text-xs text-fg-secondary">
            {keys.length} {keys.length === 1 ? 'key' : 'keys'}
          </span>
        </div>
        {loading ? (
          <div className="p-4 text-sm text-fg-secondary">Loading…</div>
        ) : keys.length === 0 ? (
          <div className="p-6 text-center text-sm text-fg-secondary">
            No keys yet. Create one above to integrate an external service.
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {keys.map(key => (
              <IntegrationKeyRow
                key={key.id}
                integrationKey={key}
                actorLabel={actors.find(a => a.actor_id === key.actor_id)?.label ?? key.actor_id}
                formatTimestamp={formatOptionalDateTime}
                onRotate={handleRotate}
                onRevoke={handleRevoke}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

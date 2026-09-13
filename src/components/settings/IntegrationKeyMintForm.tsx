'use client';

/**
 * Mint-form sub-component lifted out of IntegrationKeysCard 2026-06-04
 * to keep the parent under the 300-line component cap. Pure
 * presentation — all state lives in the parent and is passed in via
 * props. The form's onSubmit handler also lives in the parent so
 * post-mint side effects (reveal card, list prepend, reset) stay
 * collocated.
 *
 * UX surfaces in one place:
 *   - Name + actor inputs
 *   - Environment fieldset (sandbox checkbox)
 *   - Permissions fieldset (wildcard vs restrict + scope grid)
 *   - Submit button
 */

import Button from '@/components/ui/Button';
import { Plus } from 'lucide-react';
import { PUBLIC_API_ENTITY_TYPES, PUBLIC_API_SCOPE_TOKENS } from '@/config/public-api';

interface ActorOption {
  actor_id: string;
  label: string;
}

interface ScopeRowProps {
  label: string;
  readToken: string;
  writeToken: string;
  selectedScopes: Set<string>;
  onToggle: (token: string) => void;
}

function ScopeRow({ label, readToken, writeToken, selectedScopes, onToggle }: ScopeRowProps) {
  return (
    <>
      <span className="capitalize text-fg-primary">{label}</span>
      <label className="flex items-center gap-1.5 text-fg-primary">
        <input
          type="checkbox"
          checked={selectedScopes.has(readToken)}
          onChange={() => onToggle(readToken)}
        />
        <code className="rounded bg-surface-raised px-1 text-2xs">{readToken}</code>
      </label>
      <label className="flex items-center gap-1.5 text-fg-primary">
        <input
          type="checkbox"
          checked={selectedScopes.has(writeToken)}
          onChange={() => onToggle(writeToken)}
        />
        <code className="rounded bg-surface-raised px-1 text-2xs">{writeToken}</code>
      </label>
    </>
  );
}

interface Props {
  actors: ActorOption[];
  name: string;
  onNameChange: (value: string) => void;
  selectedActorId: string | null;
  onActorChange: (value: string | null) => void;
  isTest: boolean;
  onIsTestChange: (value: boolean) => void;
  restrictPermissions: boolean;
  onRestrictPermissionsChange: (value: boolean) => void;
  selectedScopes: Set<string>;
  onToggleScope: (token: string) => void;
  onClearScopes: () => void;
  minting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function IntegrationKeyMintForm({
  actors,
  name,
  onNameChange,
  selectedActorId,
  onActorChange,
  isTest,
  onIsTestChange,
  restrictPermissions,
  onRestrictPermissionsChange,
  selectedScopes,
  onToggleScope,
  onClearScopes,
  minting,
  onSubmit,
}: Props) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-subtle bg-surface-raised/20 p-4"
    >
      <h3 className="text-sm font-medium text-fg-primary">Create a new key</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-fg-secondary">
          Name
          <input
            type="text"
            required
            maxLength={120}
            value={name}
            onChange={e => onNameChange(e.target.value)}
            placeholder='e.g. "Loki production"'
            className="mt-1 w-full rounded-md border border-subtle bg-surface-page px-3 py-2 text-sm text-fg-primary placeholder:text-fg-secondary focus:border-interactive/50 focus:outline-none"
          />
        </label>
        <label className="text-xs text-fg-secondary">
          Acts as
          <select
            value={selectedActorId ?? ''}
            onChange={e => onActorChange(e.target.value || null)}
            className="mt-1 w-full rounded-md border border-subtle bg-surface-page px-3 py-2 text-sm text-fg-primary focus:border-interactive/50 focus:outline-none"
          >
            {actors.map(actor => (
              <option key={actor.actor_id} value={actor.actor_id}>
                {actor.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="space-y-2 rounded-md border border-subtle bg-surface-page/40 p-3">
        <legend className="px-1 text-xs text-fg-secondary">Environment</legend>
        <label className="flex items-center gap-2 text-xs text-fg-primary">
          <input
            type="checkbox"
            checked={isTest}
            onChange={e => onIsTestChange(e.target.checked)}
          />
          Sandbox key (prefix <code className="rounded bg-surface-raised px-1">ock_test_</code>) —
          only reads and writes test entities. Use for integration testing without touching
          production data.
        </label>
      </fieldset>

      <fieldset className="space-y-2 rounded-md border border-subtle bg-surface-page/40 p-3">
        <legend className="px-1 text-xs text-fg-secondary">Permissions</legend>
        <label className="flex items-center gap-2 text-xs text-fg-primary">
          <input
            type="radio"
            name="permissions"
            checked={!restrictPermissions}
            onChange={() => {
              onRestrictPermissionsChange(false);
              onClearScopes();
            }}
          />
          Full access (wildcard) — the key can call every public endpoint on its actor.
        </label>
        <label className="flex items-center gap-2 text-xs text-fg-primary">
          <input
            type="radio"
            name="permissions"
            checked={restrictPermissions}
            onChange={() => onRestrictPermissionsChange(true)}
          />
          Restrict to specific scopes (least privilege).
        </label>
        {restrictPermissions && (
          <div className="mt-2 rounded-md border border-subtle bg-surface-raised/20 p-3">
            <div className="grid grid-cols-[auto,1fr,1fr] items-center gap-x-3 gap-y-1.5 text-xs">
              <span className="text-fg-secondary" />
              <span className="text-fg-secondary">Read</span>
              <span className="text-fg-secondary">Write</span>
              {PUBLIC_API_ENTITY_TYPES.map(entity => (
                <ScopeRow
                  key={entity}
                  label={entity}
                  readToken={`${entity}.read`}
                  writeToken={`${entity}.write`}
                  selectedScopes={selectedScopes}
                  onToggle={onToggleScope}
                />
              ))}
            </div>
            <p className="mt-2 text-2xs text-fg-secondary">
              {selectedScopes.size === 0
                ? 'No scopes picked — the key will be unable to do anything.'
                : `Selected: ${selectedScopes.size} of ${PUBLIC_API_SCOPE_TOKENS.length}.`}
            </p>
          </div>
        )}
      </fieldset>

      <Button type="submit" disabled={minting || !selectedActorId || !name.trim()}>
        <Plus className="mr-1 h-4 w-4" />
        {minting ? 'Creating…' : 'Create key'}
      </Button>
    </form>
  );
}

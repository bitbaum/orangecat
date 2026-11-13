'use client';

/**
 * SettingsIdentitiesSection — the names one person holds (ADR-0014).
 *
 * Lists the caller's circle (main account + identities), switches between
 * them, adds one and deletes one. Every row has the same anatomy: face, name,
 * handle, then the one thing you can do with it.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { API_ROUTES } from '@/config/api-routes';
import { IDENTITIES_COPY } from '@/config/identities';
import { logger } from '@/utils/logger';
import {
  fetchIdentityCircle,
  readIdentityError,
  notifyIdentitiesChanged,
  switchToIdentity,
  type IdentityMember,
} from '@/lib/identities/client';
import { IdentityRow } from './IdentityRow';

type Member = IdentityMember;

export function SettingsIdentitiesSection() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [max, setMax] = useState(0);
  const [canManage, setCanManage] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const circle = await fetchIdentityCircle();
      setMembers(circle.members);
      setMax(circle.max);
      setCanManage(circle.canManage);
    } catch (err) {
      // Not "no identities": the list is unknown, so nothing is offered on it.
      logger.error('Could not load identities', err, 'Settings');
      setLoadFailed(true);
    }
  }, []);

  /** Read the circle again here, and tell the menu (and any other tab view). */
  const changed = useCallback(async () => {
    await load();
    notifyIdentitiesChanged();
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSwitch = useCallback(async (id: string) => {
    setBusyId(id);
    // Resolves only on failure; on success the tab reloads as the new identity.
    toast.error(await switchToIdentity(id));
    setBusyId(null);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const res = await fetch(API_ROUTES.IDENTITIES.BY_ID(id), { method: 'DELETE' });
        if (!res.ok) {
          toast.error(await readIdentityError(res, IDENTITIES_COPY.removeFailed));
          return;
        }
        setConfirmId(null);
        toast.success('Identity deleted');
        await changed();
      } catch (err) {
        logger.error('Identity delete failed', err, 'Settings');
        toast.error(IDENTITIES_COPY.removeFailed);
      } finally {
        setBusyId(null);
      }
    },
    [changed]
  );

  const handleCreate = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setCreating(true);
      setFormError(null);
      try {
        const res = await fetch(API_ROUTES.IDENTITIES.BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, username }),
        });
        if (!res.ok) {
          setFormError(await readIdentityError(res, IDENTITIES_COPY.createFailed));
          return;
        }
        setName('');
        setUsername('');
        setAdding(false);
        toast.success('Identity created');
        await changed();
      } catch (err) {
        logger.error('Identity create failed', err, 'Settings');
        setFormError(IDENTITIES_COPY.createFailed);
      } finally {
        setCreating(false);
      }
    },
    [name, username, changed]
  );

  const identityCount = (members ?? []).filter(m => !m.isHolder).length;
  const atLimit = max > 0 && identityCount >= max;

  return (
    <div>
      <h3 className="mb-2 flex items-center text-lg font-semibold text-fg-primary">
        <Users className="mr-2 h-6 w-6" />
        {IDENTITIES_COPY.title}
      </h3>
      <p className="mb-6 max-w-prose text-fg-secondary">{IDENTITIES_COPY.intro}</p>

      {loadFailed ? (
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <p className="mb-0 text-sm text-fg-primary">{IDENTITIES_COPY.loadFailed}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={() => void load()}
          >
            {IDENTITIES_COPY.retry}
          </Button>
        </div>
      ) : members === null ? (
        <Loader2 className="h-5 w-5 animate-spin text-fg-secondary" aria-label="Loading" />
      ) : (
        <ul className="divide-y divide-border-subtle rounded-md border border-default">
          {members.map(member => (
            <IdentityRow
              key={member.id}
              member={member}
              busyId={busyId}
              confirming={confirmId === member.id}
              onSwitch={handleSwitch}
              onDelete={handleDelete}
              onConfirm={setConfirmId}
              onChanged={changed}
            />
          ))}
        </ul>
      )}

      {members !== null && !loadFailed && !canManage && (
        <p className="mt-4 text-sm text-fg-secondary">{IDENTITIES_COPY.standsAlone}</p>
      )}

      {members !== null && !loadFailed && canManage && atLimit && (
        <p className="mt-4 text-sm text-fg-secondary">{IDENTITIES_COPY.limitReached}</p>
      )}

      {members !== null && !loadFailed && canManage && !atLimit && !adding && (
        <Button type="button" variant="outline" className="mt-4" onClick={() => setAdding(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {IDENTITIES_COPY.add}
        </Button>
      )}

      {adding && (
        <form
          onSubmit={handleCreate}
          className="mt-4 space-y-4 rounded-md border border-default p-4"
        >
          <Input
            label={IDENTITIES_COPY.nameLabel}
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={60}
            required
            autoComplete="off"
          />
          <Input
            label={IDENTITIES_COPY.usernameLabel}
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            error={formError ?? undefined}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAdding(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creating || !name.trim() || !username.trim()}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {IDENTITIES_COPY.create}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

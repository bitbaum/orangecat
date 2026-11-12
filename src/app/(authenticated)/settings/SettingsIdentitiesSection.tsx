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
  switchToIdentity,
  type IdentityMember,
} from '@/lib/identities/client';
import { IdentityRow } from './IdentityRow';

type Member = IdentityMember;

export function SettingsIdentitiesSection() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [max, setMax] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const circle = await fetchIdentityCircle();
      setMembers(circle.members);
      setMax(circle.max);
    } catch (err) {
      logger.error('Could not load identities', err, 'Settings');
      setMembers([]);
    }
  }, []);

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
        await load();
      } catch (err) {
        logger.error('Identity delete failed', err, 'Settings');
        toast.error(IDENTITIES_COPY.removeFailed);
      } finally {
        setBusyId(null);
      }
    },
    [load]
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
        await load();
      } catch (err) {
        logger.error('Identity create failed', err, 'Settings');
        setFormError(IDENTITIES_COPY.createFailed);
      } finally {
        setCreating(false);
      }
    },
    [name, username, load]
  );

  const identityCount = (members ?? []).filter(m => !m.isHolder).length;
  const atLimit = max > 0 && identityCount >= max;

  return (
    <div className="border-t border-default pt-10">
      <h3 className="mb-4 flex items-center text-lg font-semibold text-fg-primary">
        <Users className="mr-2 h-6 w-6" />
        {IDENTITIES_COPY.title}
      </h3>
      <p className="mb-6 text-fg-secondary">{IDENTITIES_COPY.intro}</p>

      {members === null ? (
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
              onChanged={load}
            />
          ))}
        </ul>
      )}

      {members !== null && atLimit && (
        <p className="mt-4 text-sm text-fg-secondary">{IDENTITIES_COPY.limitReached}</p>
      )}

      {members !== null && !atLimit && !adding && (
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

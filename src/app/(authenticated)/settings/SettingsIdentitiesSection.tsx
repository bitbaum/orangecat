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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { API_ROUTES } from '@/config/api-routes';
import { IDENTITIES_COPY } from '@/config/identities';
import { ROUTES } from '@/config/routes';
import { logger } from '@/utils/logger';

interface Member {
  id: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  isHolder: boolean;
  isCurrent: boolean;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string | { message?: string } };
    const message = typeof body.error === 'string' ? body.error : body.error?.message;
    return message || fallback;
  } catch {
    return fallback;
  }
}

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
      const res = await fetch(API_ROUTES.IDENTITIES.BASE);
      if (!res.ok) {
        throw new Error(`list failed (${res.status})`);
      }
      const body = (await res.json()) as { data: { members: Member[]; max: number } };
      setMembers(body.data.members);
      setMax(body.data.max);
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
    try {
      const res = await fetch(API_ROUTES.IDENTITIES.SWITCH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        toast.error(await readError(res, IDENTITIES_COPY.switchFailed));
        setBusyId(null);
        return;
      }
      // A full load: every store and cache in the tab belongs to the account
      // that just stopped being signed in.
      window.location.assign(ROUTES.DASHBOARD.HOME);
    } catch (err) {
      logger.error('Identity switch failed', err, 'Settings');
      toast.error(IDENTITIES_COPY.switchFailed);
      setBusyId(null);
    }
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const res = await fetch(API_ROUTES.IDENTITIES.BY_ID(id), { method: 'DELETE' });
        if (!res.ok) {
          toast.error(await readError(res, IDENTITIES_COPY.removeFailed));
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
          setFormError(await readError(res, IDENTITIES_COPY.createFailed));
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
            <li key={member.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={member.avatarUrl || undefined} alt="" />
                <AvatarFallback>
                  {(member.name || member.username || '?').slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg-primary">
                  {member.name || member.username || 'Unnamed'}
                </span>
                <span className="block truncate text-sm text-fg-secondary">
                  {member.username ? `@${member.username}` : ''}
                  {member.isHolder ? ` · ${IDENTITIES_COPY.main}` : ''}
                </span>
              </span>
              {confirmId === member.id ? (
                <span className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmId(null)}
                    disabled={busyId === member.id}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(member.id)}
                    disabled={busyId === member.id}
                  >
                    {busyId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
                  </Button>
                </span>
              ) : member.isCurrent ? (
                <span className="shrink-0 text-sm text-fg-secondary">
                  {IDENTITIES_COPY.current}
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-2">
                  {!member.isHolder && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmId(member.id)}
                      disabled={busyId !== null}
                    >
                      {IDENTITIES_COPY.remove}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSwitch(member.id)}
                    disabled={busyId !== null}
                  >
                    {busyId === member.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      IDENTITIES_COPY.switchTo
                    )}
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {confirmId && <p className="mt-3 text-sm text-fg-primary">{IDENTITIES_COPY.confirmRemove}</p>}

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

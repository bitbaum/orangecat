'use client';

/**
 * The organizer's side of "Crew wanted": add roles the way you'd say them
 * ("DJ, 2 bartenders"), mark one filled when someone says yes, remove one you
 * no longer need. Filled roles stay listed here but leave the public card.
 */

import { useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { type RoleStatus } from '@/config/project-roles';
import type { EventRole } from '@/domain/events/crew';
import CrewRoleRow, { type CrewPerson } from './CrewRoleRow';
import CrewPayButton from './CrewPayButton';
import type { EventPayout } from '@/domain/events/payouts';

interface EventCrewManagerProps {
  eventId: string;
  initialRoles: EventRole[];
  /** Names of the people already in roles, by user id. */
  initialPeople: Record<string, CrewPerson>;
  /** What has already been paid out of the event. */
  initialPayouts: EventPayout[];
  /** The event's currency — fees are set in it. */
  currency: string;
}

export default function EventCrewManager({
  eventId,
  initialRoles,
  initialPeople,
  initialPayouts,
  currency,
}: EventCrewManagerProps) {
  const [payouts, setPayouts] = useState(initialPayouts);
  const [roles, setRoles] = useState(initialRoles);
  const [people, setPeople] = useState(initialPeople);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.error || 'Something went wrong');
      }
      return json?.data ?? json;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const crew = draft
      .split(/[,\n;]/)
      .map(s => s.trim())
      .filter(Boolean);
    if (crew.length === 0) {
      return;
    }
    const data = await call(API_ROUTES.EVENTS.ROLES(eventId), {
      method: 'POST',
      body: JSON.stringify({ crew }),
    });
    if (data?.roles) {
      setRoles(prev => [...prev, ...(data.roles as EventRole[])]);
      setDraft('');
    }
  }

  async function setStatus(role: EventRole, status: RoleStatus) {
    const data = await call(API_ROUTES.EVENTS.ROLE(role.id), {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (data?.role) {
      setRoles(prev => prev.map(r => (r.id === role.id ? (data.role as EventRole) : r)));
    }
  }

  const replace = (role: EventRole) =>
    setRoles(prev => prev.map(r => (r.id === role.id ? role : r)));

  async function assign(role: EventRole, username: string) {
    const data = await call(API_ROUTES.EVENTS.ROLE(role.id), {
      method: 'PATCH',
      body: JSON.stringify({ assign: username }),
    });
    if (data?.role) {
      const updated = data.role as EventRole;
      const added = updated.assignee_user_ids.find(id => !role.assignee_user_ids.includes(id));
      if (added) {
        setPeople(prev => ({
          ...prev,
          [added]: { username: username.replace(/^@/, ''), name: null },
        }));
      }
      replace(updated);
    }
  }

  async function setFee(role: EventRole, fee: number | null) {
    const data = await call(API_ROUTES.EVENTS.ROLE(role.id), {
      method: 'PATCH',
      body: JSON.stringify({ fee_amount: fee }),
    });
    if (data?.role) {
      replace(data.role as EventRole);
    }
  }

  const paidTo = (roleId: string, userId: string) =>
    payouts.find(
      p =>
        p.kind === 'crew' &&
        p.role_id === roleId &&
        p.recipient_user_id === userId &&
        p.status === 'sent'
    ) ?? null;

  async function unassign(role: EventRole, userId: string) {
    const data = await call(API_ROUTES.EVENTS.ROLE(role.id), {
      method: 'PATCH',
      body: JSON.stringify({ unassign: userId }),
    });
    if (data?.role) {
      replace(data.role as EventRole);
    }
  }

  async function remove(role: EventRole) {
    const data = await call(API_ROUTES.EVENTS.ROLE(role.id), { method: 'DELETE' });
    if (data) {
      setRoles(prev => prev.filter(r => r.id !== role.id));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          Crew
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {roles.length === 0 ? (
          <p className="text-sm text-fg-secondary">
            Who do you need to make it happen? Open roles show on the public page with a button for
            people to offer themselves.
          </p>
        ) : (
          <ul className="divide-y divide-default">
            {roles.map(role => (
              <CrewRoleRow
                key={role.id}
                role={role}
                people={people}
                busy={busy}
                onAssign={assign}
                onUnassign={unassign}
                onStatus={setStatus}
                onRemove={remove}
                onFee={setFee}
                currency={currency}
                renderPersonAction={(r, userId) => (
                  <CrewPayButton
                    roleId={r.id}
                    userId={userId}
                    feeLabel={r.fee_amount ? `${r.fee_amount} ${currency}` : null}
                    paid={paidTo(r.id, userId)}
                    onPaid={p => setPayouts(prev => [p, ...prev])}
                  />
                )}
              />
            ))}
          </ul>
        )}
        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="e.g. DJ, 2 bartenders, sound tech"
            aria-label="Crew to add"
            className="min-h-11 w-full min-w-0 rounded-md border border-default bg-surface-base px-3 text-sm text-fg-primary"
          />
          <Button type="submit" variant="outline" disabled={busy || !draft.trim()}>
            Add
          </Button>
        </form>
        {error && <p className="text-sm text-status-negative">{error}</p>}
      </CardContent>
    </Card>
  );
}

'use client';

/**
 * The organizer's side of "Crew wanted": add roles the way you'd say them
 * ("DJ, 2 bartenders"), mark one filled when someone says yes, remove one you
 * no longer need. Filled roles stay listed here but leave the public card.
 */

import { useState } from 'react';
import { Users, X, Check, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { ENGAGEMENT_LABELS, ROLE_STATUS_LABELS, type RoleStatus } from '@/config/project-roles';
import type { EventRole } from '@/domain/events/crew';

interface EventCrewManagerProps {
  eventId: string;
  initialRoles: EventRole[];
}

const label = (r: EventRole) => (r.quantity > 1 ? `${r.quantity}× ${r.role_title}` : r.role_title);

export default function EventCrewManager({ eventId, initialRoles }: EventCrewManagerProps) {
  const [roles, setRoles] = useState(initialRoles);
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
    const data = await call(`/api/events/${eventId}/roles`, {
      method: 'POST',
      body: JSON.stringify({ crew }),
    });
    if (data?.roles) {
      setRoles(prev => [...prev, ...(data.roles as EventRole[])]);
      setDraft('');
    }
  }

  async function setStatus(role: EventRole, status: RoleStatus) {
    const data = await call(`/api/event-roles/${role.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (data?.role) {
      setRoles(prev => prev.map(r => (r.id === role.id ? (data.role as EventRole) : r)));
    }
  }

  async function remove(role: EventRole) {
    const data = await call(`/api/event-roles/${role.id}`, { method: 'DELETE' });
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
              <li key={role.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <div className="break-words font-medium text-fg-primary">{label(role)}</div>
                  <div className="text-sm text-fg-secondary">
                    {ENGAGEMENT_LABELS[role.engagement_type] ?? role.engagement_type} ·{' '}
                    {ROLE_STATUS_LABELS[role.status] ?? role.status}
                  </div>
                </div>
                <div className="flex gap-1">
                  {role.status === 'open' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => setStatus(role, 'filled')}
                      aria-label={`Mark ${role.role_title} filled`}
                    >
                      <Check className="mr-1 h-4 w-4" /> Filled
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => setStatus(role, 'open')}
                      aria-label={`Reopen ${role.role_title}`}
                    >
                      <RotateCcw className="mr-1 h-4 w-4" /> Reopen
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => remove(role)}
                    aria-label={`Remove ${role.role_title}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
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

'use client';

/**
 * One crew role on the organizer's card: who is in it, a way to add someone
 * by @username, and per-person actions (take off; pay — see CrewPayButton).
 */

import { useState } from 'react';
import { Check, RotateCcw, X, DoorOpen } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ENGAGEMENT_LABELS, ROLE_STATUS_LABELS } from '@/config/project-roles';
import type { EventRole } from '@/domain/events/crew';

export interface CrewPerson {
  username: string;
  name: string | null;
}

interface CrewRoleRowProps {
  role: EventRole;
  people: Record<string, CrewPerson>;
  busy: boolean;
  onAssign: (role: EventRole, username: string) => Promise<void>;
  onUnassign: (role: EventRole, userId: string) => void;
  onStatus: (role: EventRole, status: 'open' | 'filled') => void;
  onRemove: (role: EventRole) => void;
  renderPersonAction?: (role: EventRole, userId: string) => React.ReactNode;
}

const label = (r: EventRole) => (r.quantity > 1 ? `${r.quantity}× ${r.role_title}` : r.role_title);

export default function CrewRoleRow({
  role,
  people,
  busy,
  onAssign,
  onUnassign,
  onStatus,
  onRemove,
  renderPersonAction,
}: CrewRoleRowProps) {
  const [who, setWho] = useState('');
  const room = role.quantity - role.assignee_user_ids.length;

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 break-words font-medium text-fg-primary">
            {label(role)}
            {role.can_check_in && (
              <DoorOpen className="h-4 w-4 text-fg-secondary" aria-label="Can check guests in" />
            )}
          </div>
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
              onClick={() => onStatus(role, 'filled')}
              aria-label={`Mark ${role.role_title} filled`}
            >
              <Check className="mr-1 h-4 w-4" /> Filled
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onStatus(role, 'open')}
              aria-label={`Reopen ${role.role_title}`}
            >
              <RotateCcw className="mr-1 h-4 w-4" /> Reopen
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onRemove(role)}
            aria-label={`Remove ${role.role_title}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {role.assignee_user_ids.length > 0 && (
        <ul className="space-y-1">
          {role.assignee_user_ids.map(id => {
            const p = people[id];
            return (
              <li key={id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0 break-words text-fg-primary">
                  {p ? `${p.name || p.username} · @${p.username}` : 'Someone'}
                </span>
                <span className="flex items-center gap-1">
                  {renderPersonAction?.(role, id)}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => onUnassign(role, id)}
                    aria-label={`Take ${p?.username ?? 'them'} off ${role.role_title}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {room > 0 && (
        <form
          className="flex gap-2"
          onSubmit={async e => {
            e.preventDefault();
            if (who.trim()) {
              await onAssign(role, who.trim());
              setWho('');
            }
          }}
        >
          <input
            value={who}
            onChange={e => setWho(e.target.value)}
            placeholder="@username"
            aria-label={`Who is ${role.role_title}?`}
            className="min-h-11 w-full min-w-0 rounded-md border border-default bg-surface-base px-3 text-sm text-fg-primary"
          />
          <Button type="submit" variant="outline" size="sm" disabled={busy || !who.trim()}>
            Add
          </Button>
        </form>
      )}
    </li>
  );
}

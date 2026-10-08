'use client';

/**
 * Who has a link to the room, and what each of them opened.
 */

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Eye, Link2, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { API_ROUTES } from '@/config/api-routes';
import { SITE_URL } from '@/config/brand';
import { ROOM_COPY } from '@/config/project-room';
import { ROUTES } from '@/config/routes';
import type { RoomLink, RoomOpen } from '@/domain/projectRooms/types';
import { RoomLinkRow } from './RoomLinkRow';

interface RoomLinksProps {
  projectId: string;
  links: RoomLink[];
  opens: RoomOpen[];
  onLinksChange: (links: RoomLink[]) => void;
}

export function roomUrl(token: string): string {
  return `${SITE_URL}${ROUTES.ROOM(token)}`;
}

export async function copyRoomUrl(token: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(roomUrl(token));
    toast.success('Link copied');
  } catch {
    toast.message(roomUrl(token));
  }
}

export function RoomLinks({ projectId, links, opens, onLinksChange }: RoomLinksProps) {
  const [label, setLabel] = useState('');
  const [email, setEmail] = useState('');
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!label.trim()) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(API_ROUTES.PROJECTS.ROOM_LINKS(projectId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, email: email.trim() || null, is_shared: shared }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data) {
        toast.error(body?.error?.message ?? 'Could not create the link');
        return;
      }
      const link = body.data as RoomLink;
      onLinksChange([link, ...links]);
      setLabel('');
      setEmail('');
      setShared(false);
      await copyRoomUrl(link.token);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(link: RoomLink) {
    const response = await fetch(API_ROUTES.PROJECTS.ROOM_LINK(projectId, link.id), {
      method: 'DELETE',
    });
    if (!response.ok) {
      toast.error('Could not switch the link off');
      return;
    }
    onLinksChange(
      links.map(l => (l.id === link.id ? { ...l, revoked_at: new Date().toISOString() } : l))
    );
    toast.success(`${link.label}’s link is off`);
  }

  return (
    <section className="mt-10">
      <h2 className="font-heading text-xl font-semibold tracking-display text-fg-primary">
        People
      </h2>

      <form
        onSubmit={create}
        className="mt-4 space-y-3 rounded-lg border border-border-subtle bg-surface-base p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Who is it for?"
            placeholder="Anna Keller, Seedcamp"
            value={label}
            maxLength={120}
            onChange={e => setLabel(e.target.value)}
            required
          />
          <Input
            label="Their email (optional, for your records)"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>
        <label className="flex min-h-11 items-start gap-2 text-sm text-fg-secondary">
          <input
            type="checkbox"
            className="mt-1"
            checked={shared}
            onChange={e => setShared(e.target.checked)}
          />
          <span>
            Shared link — <span className="text-fg-muted">{ROOM_COPY.sharedLinkHint}</span>
          </span>
        </label>
        <Button type="submit" variant="accent" isLoading={busy} disabled={!label.trim()}>
          <Plus className="h-4 w-4" aria-hidden />
          Create link and copy it
        </Button>
      </form>

      {links.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-fg-muted">
          <Link2 className="h-4 w-4" aria-hidden />
          No links yet. Create one for each person you send the room to.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border-subtle rounded-lg border border-border-subtle">
          {links.map(link => (
            <RoomLinkRow
              key={link.id}
              link={link}
              opens={opens.filter(o => o.link_id === link.id)}
              onRevoke={() => revoke(link)}
            />
          ))}
        </ul>
      )}
      {links.length > 0 && (
        <p className="mt-2 flex items-center gap-1 text-xs text-fg-muted">
          <Eye className="h-3 w-3" aria-hidden />
          Your own visits through a preview are not counted.
        </p>
      )}
    </section>
  );
}

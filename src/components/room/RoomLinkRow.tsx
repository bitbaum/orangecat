'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { RoomLink, RoomOpen } from '@/domain/projectRooms/types';
import { formatRelativeTime } from '@/utils/dates';
import { copyRoomUrl } from './RoomLinks';

const WHAT_LABEL: Record<RoomOpen['what'], string> = {
  room: 'the room',
  deck: 'the deck',
  build: 'the build record',
  document: 'a document',
};

/** "the deck ×2 · Financials · the build record" — what this link opened, most first. */
export function summariseOpens(opens: RoomOpen[]): string {
  const counts = new Map<string, number>();
  for (const open of opens) {
    if (open.what === 'room') {
      continue;
    }
    const name = open.what === 'document' && open.target ? open.target : WHAT_LABEL[open.what];
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => (n > 1 ? `${name} ×${n}` : name))
    .join(' · ');
}

interface RoomLinkRowProps {
  link: RoomLink;
  opens: RoomOpen[];
  onRevoke: () => void;
}

export function RoomLinkRow({ link, opens, onRevoke }: RoomLinkRowProps) {
  const [confirming, setConfirming] = useState(false);
  const off = !!link.revoked_at;
  const visits = opens.filter(o => o.what === 'room').length;
  const opened = summariseOpens(opens);

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${off ? 'text-fg-muted line-through' : 'text-fg-primary'}`}
        >
          {link.label}
          {link.is_shared && <span className="ml-2 text-xs font-normal text-fg-muted">shared</span>}
        </p>
        {link.email && <p className="text-xs text-fg-muted">{link.email}</p>}
        <p className="mt-1 text-xs text-fg-secondary">
          {link.last_opened_at
            ? `${visits || link.open_count} ${visits === 1 ? 'visit' : 'visits'} · last ${formatRelativeTime(link.last_opened_at)}`
            : off
              ? 'Switched off before it was opened'
              : 'Not opened yet'}
          {off && link.last_opened_at ? ' · switched off' : ''}
        </p>
        {opened && <p className="mt-0.5 text-xs text-fg-muted">Opened {opened}</p>}
      </div>
      {!off && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => copyRoomUrl(link.token)}>
            <Copy className="h-4 w-4" aria-hidden />
            Copy
          </Button>
          {confirming ? (
            <Button variant="danger" size="sm" onClick={onRevoke}>
              Switch off
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
              Switch off…
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

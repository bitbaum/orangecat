'use client';

/**
 * The list: every chat the person can open, one anatomy per row — a face,
 * the name with its job, the last line, when — newest first, with a search
 * box and one "+" that offers New companion · New group chat.
 */

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { COMPANION_COPY } from '@/config/companions';
import { ROUTES } from '@/config/routes';
import { Face, GroupFaces } from './CompanionFace';
import { matchesQuery, nameWithJob, whenLabel } from './format';
import type { TalkHomeData, TalkTarget } from './types';
import { sameTarget } from './types';

interface Row {
  key: string;
  href: string;
  target: TalkTarget;
  title: string;
  job: string | null;
  preview: string | null;
  at: string | null;
  face: React.ReactNode;
}

export function rowsFor(home: TalkHomeData, fleetPreviews: Record<string, string | null>): Row[] {
  const rows: Row[] = [];
  for (const c of home.companions) {
    rows.push({
      key: `c:${c.id}`,
      href: ROUTES.AI_ASSISTANTS.TALK_WITH(c.id),
      target: { kind: 'companion', id: c.id },
      title: c.title,
      job: c.description,
      preview: c.preview,
      at: c.lastAt,
      face: <Face name={c.title} avatarUrl={c.avatarUrl} />,
    });
  }
  for (const r of home.rooms) {
    rows.push({
      key: `r:${r.id}`,
      href: ROUTES.AI_ASSISTANTS.TALK_ROOM(r.id),
      target: { kind: 'room', id: r.id },
      title: r.title,
      job: null,
      preview: r.preview ?? COMPANION_COPY.talk.groupLine(r.members.length),
      at: r.lastMessageAt ?? r.createdAt,
      face: <GroupFaces members={r.members} />,
    });
  }
  for (const b of home.fleet.bots) {
    rows.push({
      key: `f:${b.slug}`,
      href: ROUTES.AI_ASSISTANTS.TALK_FLEET(b.slug),
      target: { kind: 'fleet', slug: b.slug },
      title: b.name,
      job: b.job,
      preview: fleetPreviews[b.slug] ?? null,
      at: null,
      face: <Face name={b.name} avatarUrl={b.mark} />,
    });
  }
  return rows.sort((a, b) => {
    if (a.at && b.at) {
      return b.at.localeCompare(a.at);
    }
    return a.at ? -1 : b.at ? 1 : 0;
  });
}

export function TalkList({
  home,
  open,
  fleetPreviews,
  onNewCompanion,
  onNewRoom,
}: {
  home: TalkHomeData | null;
  open: TalkTarget;
  fleetPreviews: Record<string, string | null>;
  onNewCompanion: () => void;
  onNewRoom: () => void;
}) {
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState(false);
  const copy = COMPANION_COPY.talk;
  const rows = useMemo(() => (home ? rowsFor(home, fleetPreviews) : []), [home, fleetPreviews]);
  const shown = rows.filter(r => matchesQuery(`${r.title} ${r.job ?? ''}`, query));

  return (
    <nav aria-label={copy.title} className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <h1 className="text-xl font-semibold text-fg-primary">{copy.title}</h1>
        <div className="relative">
          <button
            type="button"
            aria-label={copy.newCompanion}
            aria-expanded={menu}
            onClick={() => setMenu(v => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-raised text-fg-primary hover:bg-surface-hover"
          >
            <Plus className="h-5 w-5" />
          </button>
          {menu && (
            <div
              role="menu"
              className="absolute right-0 top-12 z-20 w-56 overflow-hidden rounded-2xl border border-subtle bg-surface-base shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                className="block w-full px-4 py-3 text-left text-base text-fg-primary hover:bg-surface-hover"
                onClick={() => {
                  setMenu(false);
                  onNewCompanion();
                }}
              >
                {copy.newCompanion}
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-4 py-3 text-left text-base text-fg-primary hover:bg-surface-hover"
                onClick={() => {
                  setMenu(false);
                  onNewRoom();
                }}
              >
                {copy.newGroup}
              </button>
            </div>
          )}
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto px-2">
        {home && shown.length === 0 && (
          <li className="px-3 py-10 text-center">
            <p className="mb-1 text-base font-semibold text-fg-primary">{copy.empty.title}</p>
            <p className="mb-0 text-sm text-fg-secondary">{copy.empty.body}</p>
          </li>
        )}
        {shown.map(row => {
          const active = sameTarget(open, row.target);
          return (
            <li key={row.key}>
              <Link
                href={row.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[72px] items-center gap-3 rounded-2xl px-3 py-2 ${
                  active ? 'bg-surface-raised' : 'hover:bg-surface-hover'
                }`}
              >
                {row.face}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-base font-medium text-fg-primary">
                      {nameWithJob(row.title, row.job)}
                    </span>
                    <span className="shrink-0 text-xs text-fg-tertiary">{whenLabel(row.at)}</span>
                  </span>
                  <span className="block truncate text-sm text-fg-secondary">
                    {(row.preview ?? (row.job ? '' : copy.noJob)) || copy.noActivityYet}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
        {home && !home.fleet.mapReachable && (
          <li className="px-3 py-2 text-xs text-fg-tertiary">{copy.fleetUnreachable}</li>
        )}
      </ul>

      <div className="px-3 pb-3 pt-2">
        <label className="flex h-11 items-center gap-2 rounded-full bg-surface-raised px-4">
          <Search className="h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={copy.search}
            aria-label={copy.search}
            className="min-w-0 flex-1 bg-transparent text-base text-fg-primary outline-none placeholder:text-fg-tertiary"
          />
        </label>
      </div>
    </nav>
  );
}

'use client';

/**
 * The owner's side of an investor room (ADR-0012). People first — who has a
 * link and what they opened is the reason to have a room — then what it says.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import type { OwnerRoom, RoomLink } from '@/domain/projectRooms/types';
import { RoomLinks } from './RoomLinks';
import { RoomEditor } from './RoomEditor';

interface RoomManagerProps {
  initial: OwnerRoom;
  buildRecordUrl: string | null;
}

export function RoomManager({ initial, buildRecordUrl }: RoomManagerProps) {
  const { project } = initial;
  const [links, setLinks] = useState<RoomLink[]>(initial.links);
  const previewLink = links.find(link => !link.revoked_at);

  return (
    <div className="min-h-[calc(100svh-4rem)] bg-surface-page">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          href={ROUTES.PROJECTS.VIEW(project.id)}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-fg-secondary hover:text-fg-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {project.title}
        </Link>

        <header className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-display text-fg-primary">
              Investor room
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-fg-secondary">
              A private page for the people you choose. Each person gets their own link — no
              account, no password — and you see what they opened. Switch a link off at any time.
            </p>
          </div>
          {previewLink && (
            <Button variant="outline" href={ROUTES.ROOM(previewLink.token)}>
              <Eye className="h-4 w-4" aria-hidden />
              Preview
            </Button>
          )}
        </header>

        <RoomLinks
          projectId={project.id}
          links={links}
          opens={initial.opens}
          onLinksChange={setLinks}
        />

        <RoomEditor
          projectId={project.id}
          initial={initial.content}
          saved={initial.exists}
          buildRecordUrl={buildRecordUrl}
        />
      </div>
    </div>
  );
}

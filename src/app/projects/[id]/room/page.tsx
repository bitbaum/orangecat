/**
 * /projects/[id]/room — the owner's side of the investor room (ADR-0012):
 * what the room says, who has a link, and what each of them opened.
 */

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { RoomManager } from '@/components/room/RoomManager';
import { ROUTES } from '@/config/routes';
import { getOwnerRoom } from '@/domain/projectRooms/service';
import { createServerClient } from '@/lib/supabase/server';
import { getLokiProjectLink } from '@/services/loki/project-link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Investor room',
  robots: { index: false, follow: false },
};

export default async function ProjectRoomPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`${ROUTES.AUTH_LOGIN}&redirect=${encodeURIComponent(ROUTES.PROJECTS.ROOM(id))}`);
  }

  const result = await getOwnerRoom(id, user.id, supabase);
  if (!result.ok) {
    if (result.code === 'forbidden') {
      redirect(ROUTES.PROJECTS.VIEW(id));
    }
    notFound();
  }

  const build = await getLokiProjectLink(id);

  return (
    <RoomManager
      initial={result.data}
      buildRecordUrl={build.linked ? (build.profileUrl ?? null) : null}
    />
  );
}

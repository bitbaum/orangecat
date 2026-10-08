import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { RoomView } from '@/components/room/RoomView';
import { ROOM_COPY } from '@/config/project-room';
import { getRoomByToken, recordRoomOpen } from '@/domain/projectRooms/open';
import { isLinkPreviewBot, isPrefetchRequest } from '@/lib/link-preview-bots';
import { checkOwnership, getActorDisplayName } from '@/services/actors';
import { getLokiProjectLink } from '@/services/loki/project-link';
import { getAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';

interface PageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const room = await getRoomByToken(token);
  // Never indexed, and the preview card names the project but none of the room.
  return {
    title: room.ok ? `${room.data.project.title} — investor room` : 'Investor room',
    description: 'A private investor room.',
    robots: { index: false, follow: false },
  };
}

async function viewerOwns(actorId: string | null): Promise<boolean> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user && (await checkOwnership({ actor_id: actorId }, user.id, supabase));
}

function Closed({ message }: { message: string }) {
  return (
    <div className="min-h-[calc(100svh-4rem)] bg-surface-page">
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-xs font-medium uppercase tracking-caps text-fg-muted">Investor room</p>
        <p className="mt-4 text-base text-fg-secondary">{message}</p>
      </div>
    </div>
  );
}

export default async function RoomPage({ params }: PageProps) {
  const { token } = await params;
  const room = await getRoomByToken(token);
  if (!room.ok) {
    return <Closed message={room.code === 'revoked' ? ROOM_COPY.revokedNotice : room.message} />;
  }

  // The one place a visit to the page is counted (metadata above does not), and
  // never for a messenger drawing the link's preview card or for the owner
  // previewing their own room.
  const { project } = room.data;
  const requestHeaders = await headers();
  if (
    !isLinkPreviewBot(requestHeaders.get('user-agent')) &&
    !isPrefetchRequest(requestHeaders) &&
    !(await viewerOwns(project.actor_id))
  ) {
    await recordRoomOpen(room.data, 'room');
  }

  const [ownerName, build] = await Promise.all([
    project.actor_id
      ? getActorDisplayName(project.actor_id, getAdminClient())
      : Promise.resolve('The owner'),
    getLokiProjectLink(project.id),
  ]);

  return (
    <RoomView
      token={token}
      room={room.data}
      ownerName={ownerName}
      isShared={room.data.link.is_shared}
      hasBuildRecord={build.linked}
    />
  );
}

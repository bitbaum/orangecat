import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { RoomView } from '@/components/room/RoomView';
import { ROOM_COPY } from '@/config/project-room';
import { getRoomByToken, recordRoomOpen } from '@/domain/projectRooms/open';
import { countsAsOpen } from '@/domain/projectRooms/counts';
import { getActorDisplayName } from '@/services/actors';
import { getLokiProjectLink } from '@/services/loki/project-link';
import { getRoomEvidence } from '@/domain/projectRooms/evidence';
import { loadRoomDeck } from '@/domain/projectRooms/deck';
import { getAdminClient } from '@/lib/supabase/admin';

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

  // The one place a visit to the page is counted (metadata above does not) —
  // by the same rule as every open inside the room (countsAsOpen).
  const { project } = room.data;
  if (await countsAsOpen(await headers(), project.actor_id)) {
    await recordRoomOpen(room.data, 'room');
  }

  const [ownerName, build, evidence, deck] = await Promise.all([
    project.actor_id
      ? getActorDisplayName(project.actor_id, getAdminClient())
      : Promise.resolve('The owner'),
    getLokiProjectLink(project.id),
    getRoomEvidence(project.id),
    loadRoomDeck(project.id),
  ]);

  return (
    <RoomView
      token={token}
      room={room.data}
      evidence={evidence}
      ownerName={ownerName}
      isShared={room.data.link.is_shared}
      hasBuildRecord={build.linked}
      hasDeck={deck !== null}
    />
  );
}

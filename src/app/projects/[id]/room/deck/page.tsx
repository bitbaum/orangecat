/**
 * /projects/[id]/room/deck — the owner's deck editor (@bitbaum/deckkit):
 * generate a first draft from the room, edit every slide, present it.
 */

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import '@bitbaum/deckkit/styles.css';
import { DeckEditor } from '@/components/room/deck/DeckEditor';
import { ROUTES } from '@/config/routes';
import { deckDataFromEvidence, deckSourceFromRoom, loadRoomDeck } from '@/domain/projectRooms/deck';
import { getRoomEvidence } from '@/domain/projectRooms/evidence';
import { getOwnerRoom } from '@/domain/projectRooms/service';
import { createServerClient } from '@/lib/supabase/server';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Deck',
  robots: { index: false, follow: false },
};

export default async function RoomDeckEditorPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`${ROUTES.AUTH_LOGIN}&redirect=${encodeURIComponent(ROUTES.PROJECTS.ROOM_DECK(id))}`);
  }

  const room = await getOwnerRoom(id, user.id, supabase);
  if (!room.ok) {
    if (room.code === 'forbidden') {
      redirect(ROUTES.PROJECTS.VIEW(id));
    }
    notFound();
  }

  const [deck, evidence] = await Promise.all([loadRoomDeck(id), getRoomEvidence(id)]);

  return (
    <DeckEditor
      projectId={id}
      projectTitle={room.data.project.title}
      initialDeck={deck}
      source={deckSourceFromRoom(room.data.project, room.data.content, evidence)}
      data={deckDataFromEvidence(evidence)}
    />
  );
}

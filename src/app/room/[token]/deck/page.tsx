/**
 * /room/[token]/deck — the room's deck, presented, for the person the link was
 * sent to. Bound slides are filled from the room's live evidence at this
 * moment, so the numbers are today's. Opening it counts as opening the deck,
 * by the one rule every room open uses (countsAsOpen).
 */

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { bindDeck } from '@bitbaum/deckkit';
import '@bitbaum/deckkit/styles.css';
import { RoomDeckPresenter } from '@/components/room/RoomDeckPresenter';
import { ROUTES } from '@/config/routes';
import { countsAsOpen } from '@/domain/projectRooms/counts';
import { deckDataFromEvidence, loadRoomDeck } from '@/domain/projectRooms/deck';
import { getRoomEvidence } from '@/domain/projectRooms/evidence';
import { getRoomByToken, recordRoomOpen } from '@/domain/projectRooms/open';

interface PageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const room = await getRoomByToken(token);
  return {
    title: room.ok ? `${room.data.project.title} — deck` : 'Deck',
    robots: { index: false, follow: false },
  };
}

export default async function RoomDeckPage({ params }: PageProps) {
  const { token } = await params;
  const room = await getRoomByToken(token);
  if (!room.ok) {
    redirect(ROUTES.ROOM(token));
  }
  const { project } = room.data;
  const [deck, evidence] = await Promise.all([
    loadRoomDeck(project.id),
    getRoomEvidence(project.id),
  ]);
  if (!deck) {
    redirect(ROUTES.ROOM(token));
  }

  if (await countsAsOpen(await headers(), project.actor_id)) {
    await recordRoomOpen(room.data, 'deck');
  }

  return (
    <RoomDeckPresenter
      deck={bindDeck(deck, deckDataFromEvidence(evidence))}
      roomHref={ROUTES.ROOM(token)}
    />
  );
}

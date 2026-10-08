'use client';

import type { Deck } from '@bitbaum/deckkit';
import { DeckPresenter } from '@bitbaum/deckkit/react';

/**
 * The room's deck for a reader: no speaker notes, and a way back to the room.
 * A plain <a>, not a Link — nothing in a reader's path may prefetch.
 */
export function RoomDeckPresenter({ deck, roomHref }: { deck: Deck; roomHref: string }) {
  return <DeckPresenter deck={deck} extraControls={<a href={roomHref}>Room</a>} />;
}

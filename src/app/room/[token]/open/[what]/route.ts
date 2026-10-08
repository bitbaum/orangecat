/**
 * GET /room/[token]/open/[what] — follow something inside a room (the deck, a
 * document, the build record) and record that this link opened it.
 *
 * Not an open redirect: the destination is looked up in the room's own content
 * by kind and index, never read from the request. Anything the room does not
 * list sends the visitor back to the room.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ROUTES } from '@/config/routes';
import { resolveOpenTarget } from '@/domain/projectRooms/content';
import { getRoomByToken, recordRoomOpen } from '@/domain/projectRooms/open';
import { getLokiProjectLink } from '@/services/loki/project-link';
import { countsAsOpen } from '@/domain/projectRooms/counts';
import { loadRoomDeck } from '@/domain/projectRooms/deck';

interface RouteContext {
  params: Promise<{ token: string; what: string }>;
}

const OPENABLE = new Set(['deck', 'document', 'build']);

export async function GET(request: NextRequest, context: RouteContext) {
  const { token, what } = await context.params;
  const back = NextResponse.redirect(new URL(ROUTES.ROOM(token), request.url));

  if (!OPENABLE.has(what)) {
    return back;
  }
  const room = await getRoomByToken(token);
  if (!room.ok) {
    return back;
  }

  // A deck made in the room is presented in the room; its page records the
  // open itself (so a deep link to slide 3 counts too) — no record here.
  if (what === 'deck' && (await loadRoomDeck(room.data.project.id))) {
    return NextResponse.redirect(new URL(ROUTES.ROOM_DECK(token), request.url));
  }

  const n = request.nextUrl.searchParams.get('n');
  const index = n !== null && /^\d+$/.test(n) ? Number(n) : null;
  const build = what === 'build' ? await getLokiProjectLink(room.data.project.id) : null;
  const target = resolveOpenTarget(room.data.content, what, index, build?.profileUrl ?? null);
  if (!target) {
    return back;
  }

  if (await countsAsOpen(request.headers, room.data.project.actor_id)) {
    await recordRoomOpen(room.data, what as 'deck' | 'document' | 'build', target.target);
  }
  return NextResponse.redirect(target.url);
}

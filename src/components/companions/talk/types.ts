import type { TalkHome } from '@/services/companions/talk-home';

/** What is open: a companion, a fleet bot, a group chat, or nothing. */
export type TalkTarget =
  | { kind: 'companion'; id: string }
  | { kind: 'fleet'; slug: string }
  | { kind: 'room'; id: string }
  | null;

export type TalkHomeData = TalkHome;

/** `with=<uuid>` / `with=fleet:<slug>` / `room=<uuid>` → a target. */
export function targetFromParams(params: URLSearchParams | null): TalkTarget {
  const room = params?.get('room');
  if (room) {
    return { kind: 'room', id: room };
  }
  const w = params?.get('with');
  if (!w) {
    return null;
  }
  if (w.startsWith('fleet:')) {
    return { kind: 'fleet', slug: w.slice('fleet:'.length) };
  }
  return { kind: 'companion', id: w };
}

export function sameTarget(a: TalkTarget, b: TalkTarget): boolean {
  if (!a || !b || a.kind !== b.kind) {
    return a === b;
  }
  return a.kind === 'fleet'
    ? a.slug === (b as { slug: string }).slug
    : a.id === (b as { id: string }).id;
}

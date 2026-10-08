import {
  roomDocumentSchema,
  roomMetricSchema,
  roomSectionSchema,
  type RoomContent,
  type RoomDocument,
  type RoomMetric,
  type RoomSection,
} from '@/config/project-room';

function each<T>(value: unknown, parse: (item: unknown) => T | null): T[] {
  return Array.isArray(value) ? value.map(parse).filter((x): x is T => x !== null) : [];
}

/**
 * A stored room, read leniently: an entry that no longer fits the schema is
 * dropped rather than failing the room, so a link already sent to someone
 * never opens onto an error because a limit was tightened after it was saved.
 */
export function normalizeRoomContent(row: Record<string, unknown>): RoomContent {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    headline: str(row.headline),
    sections: each<RoomSection>(row.sections, s => {
      const r = roomSectionSchema.safeParse(s);
      return r.success ? r.data : null;
    }),
    metrics: each<RoomMetric>(row.metrics, m => {
      const r = roomMetricSchema.safeParse(m);
      return r.success ? r.data : null;
    }),
    metrics_as_of: str(row.metrics_as_of)?.slice(0, 10) ?? null,
    deck_url: str(row.deck_url),
    documents: each<RoomDocument>(row.documents, d => {
      const r = roomDocumentSchema.safeParse(d);
      return r.success ? r.data : null;
    }),
    contact_email: str(row.contact_email),
  };
}

/** Sections a visitor sees: the ones with something written in them. */
export function visibleSections(content: RoomContent): RoomSection[] {
  return content.sections.filter(s => s.body.trim().length > 0);
}

/**
 * Where an open inside the room leads. Only places the room itself lists — the
 * route that follows them must never become a redirect anyone can aim.
 */
export function resolveOpenTarget(
  content: RoomContent,
  what: string,
  index: number | null,
  buildUrl: string | null
): { url: string; target: string | null } | null {
  if (what === 'deck') {
    return content.deck_url ? { url: content.deck_url, target: null } : null;
  }
  if (what === 'build') {
    return buildUrl ? { url: buildUrl, target: null } : null;
  }
  if (what === 'document' && index !== null && Number.isInteger(index) && index >= 0) {
    const doc = content.documents[index];
    return doc ? { url: doc.url, target: doc.title } : null;
  }
  return null;
}

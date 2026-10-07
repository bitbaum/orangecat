/**
 * One line naming where an event is: venue, address, city — whatever is known.
 * Shared by the page metadata, the JSON-LD, the calendar entry and the
 * ticket. Events have no `location` column — reading one made every event
 * page's metadata query fail into "Event Not Found".
 */
export function eventPlaceText(entity: Record<string, unknown>): string | null {
  const parts = [entity.venue_name, entity.venue_address, entity.venue_city].filter(
    (p): p is string => typeof p === 'string' && p.trim().length > 0
  );
  return parts.length > 0 ? parts.map(p => p.trim()).join(', ') : null;
}

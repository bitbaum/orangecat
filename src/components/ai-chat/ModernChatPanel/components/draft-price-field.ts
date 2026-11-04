/**
 * Which body field a Cat draft card's price goes into. Services are priced as
 * `hourly_rate` or `fixed_price` (the API requires one of them); every other
 * priced entity uses `price`. Publishing a Cat service draft used to send
 * `price` and fail with "Invalid request body" (Nov 2026).
 */
export function draftPriceField(
  entityType: string,
  data: Record<string, unknown>
): 'price' | 'hourly_rate' | 'fixed_price' {
  if (entityType !== 'service') {
    return 'price';
  }
  const has = (v: unknown) => v !== null && v !== undefined && v !== '';
  return has(data.hourly_rate) && !has(data.fixed_price) ? 'hourly_rate' : 'fixed_price';
}

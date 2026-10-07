/**
 * Fill a route template from a record: `/groups/[slug]` or `/loans/:id`.
 *
 * Two places built create redirects, and the success screen's copy replaced
 * only `id` — so a new group linked to the literal `/groups/[slug]`, a
 * not-found page (audit 2026-10-07). One filler, every placeholder.
 */
export function fillUrlTemplate(template: string, record: Record<string, unknown>): string {
  const value = (field: string) => {
    const v = record[field];
    return v === null || v === undefined ? '' : encodeURIComponent(String(v));
  };
  return template
    .replace(/:(\w+)/g, (_, f: string) => value(f))
    .replace(/\[(\w+)\]/g, (_, f: string) => value(f));
}

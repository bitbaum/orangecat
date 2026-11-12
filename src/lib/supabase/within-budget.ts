/**
 * A database that does not answer must cost a prerendered page its DB-backed
 * part, never the build. Next gives a prerendered route 60 s, three times,
 * then fails the whole export. On 2026-11-12, with the self-hosted box out of
 * memory, every CI build died on /sitemap.xml and /roadmap this way: their
 * reads never threw, they just never answered, so no try/catch could help.
 *
 * Race the work against a budget; past it, reject so the caller's existing
 * "omit and log" path runs. Revalidation fills the part back in later.
 */
export const DB_BUDGET_MS = 15_000;

export function withinDbBudget<T>(work: Promise<T>, ms: number = DB_BUDGET_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`the database gave no answer within ${ms / 1000} s`)),
      ms
    );
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

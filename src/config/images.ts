/**
 * Image feature limits — SSOT shared by the API routes (zod) and the UI
 * (input maxLength / disabled states), so the two can't disagree and produce
 * bare "Invalid request" errors.
 */
export const IMAGE_PROMPT_LIMITS = { min: 3, max: 1000 } as const;
export const IMAGE_SEARCH_QUERY_MAX = 80;
/** Openverse results fetched per query; also the per-query page size. */
export const IMAGES_PER_QUERY = 8;
/**
 * Shown when the free-photo service did not answer, so an outage never reads
 * as "no matches". It names the two ways on that always work.
 */
export const IMAGE_SEARCH_DOWN_MESSAGE =
  'The free photo service is not answering right now. Try again in a minute, or upload your own photo.';

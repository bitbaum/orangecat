/**
 * An article can also go on the walls of the writer's own projects, the way a
 * short post can be cross-posted. Which projects count is decided once, by
 * `fetchUserProjects` (owned by the writer's actor, not a draft) — the same list
 * the short-post composer offers. These helpers only match against that list.
 */
import { slugify } from '@/utils/string';

interface ProjectRef {
  id: string;
  title: string;
}

/**
 * The project a `?project=` link names, if it is one of the writer's: an exact
 * id, or a slug of its title (`?project=solon` for "Solon"). Anything else is
 * null — the composer then preselects nothing and says so.
 */
export function resolveProjectParam(
  param: string | null | undefined,
  owned: readonly ProjectRef[]
): string | null {
  const wanted = param?.trim();
  if (!wanted) {
    return null;
  }
  const byId = owned.find(project => project.id === wanted);
  if (byId) {
    return byId.id;
  }
  const slug = slugify(wanted);
  if (!slug) {
    return null;
  }
  return owned.find(project => slugify(project.title) === slug)?.id ?? null;
}

/** The requested project ids that are the writer's own, once each, in the order asked. */
export function ownedProjectIds(
  requested: readonly string[] | undefined,
  owned: readonly Pick<ProjectRef, 'id'>[]
): string[] {
  if (!requested?.length) {
    return [];
  }
  const ownedIds = new Set(owned.map(project => project.id));
  return [...new Set(requested)].filter(id => ownedIds.has(id));
}

import { ECOSYSTEM, LOKI_ENDPOINTS } from '@/config/ecosystem';

/**
 * "Is this project already being built in Loki, and where can a reader see it?"
 *
 * WHY THIS EXISTS
 * A project page offered its owner "Build it with Loki — Loki asks you a few
 * questions and puts an AI agent on it" for projects that had been building in
 * Loki for months. The page had no way to know, so it addressed every owner as
 * a first-time visitor to work already done.
 *
 * And the more valuable half: a reader deciding whether to fund something had
 * no way to reach its build record. A page that shows what was actually built,
 * and when, is evidence — the part of a transparency claim that better copy
 * cannot manufacture. That link did not exist on this side at all.
 *
 * NEVER FAILS THE PAGE. Loki is a separate product on a separate deploy; a slow
 * or absent neighbour must cost this page nothing. Every error path returns
 * "not linked", which is the state the page already knows how to render.
 */

export interface LokiProjectLink {
  linked: boolean;
  /** The project's name in Loki, when it has one. */
  name?: string | null;
  /** Public build profile — purpose, roadmap, changelog, what moved last. */
  profileUrl?: string | null;
}

const NOT_LINKED: LokiProjectLink = { linked: false };

/** Short: this runs inside a page render, and a neighbour's latency is not ours. */
const TIMEOUT_MS = 2_500;
/** Loki answers with the same cache window; asking more often buys nothing. */
const REVALIDATE_SECONDS = 120;

export async function getLokiProjectLink(projectId: string): Promise<LokiProjectLink> {
  if (!projectId) {
    return NOT_LINKED;
  }

  try {
    const url = new URL(LOKI_ENDPOINTS.projectLink, ECOSYSTEM.loki.siteUrl);
    url.searchParams.set('project_id', projectId);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      return NOT_LINKED;
    }

    const body = (await response.json()) as LokiProjectLink;
    // A `linked: true` with no destination is not a link anyone can follow —
    // treat it as absent rather than rendering a card that goes nowhere.
    if (!body?.linked || !body.profileUrl) {
      return NOT_LINKED;
    }

    return { linked: true, name: body.name ?? null, profileUrl: body.profileUrl };
  } catch {
    return NOT_LINKED;
  }
}

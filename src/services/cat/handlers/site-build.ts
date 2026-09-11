/**
 * `build_site` — Cat commissions a real, deployed website.
 *
 * The whole handler is about saying the true thing. FleetCrown answers 202:
 * the request is QUEUED, and the repository, box sync and deploy take minutes.
 * So there is no moment during this turn at which a site exists, and every
 * sentence handed back says a build was started rather than that a site is
 * ready.
 *
 * That is not pedantry about tense. This repo has already paid for the
 * opposite: an action that logged `completed` while only one of two stores had
 * changed, and a Cat that said "I've removed the incorrect skills" while
 * nothing had. An agent reporting a side effect it never observed is the
 * expensive bug, and a queued build is the easiest possible place to make it.
 */
import {
  requestFleetCrownSite,
  slugFromTitle,
  CAT_SITE_KINDS,
} from '@/services/fleetcrown/site-build';
import type { CatSiteKind } from '@/services/fleetcrown/site-build';
import type { ActionHandler } from './types';

export const siteBuildHandlers: Record<string, ActionHandler> = {
  build_site: async (_supabase, _userId, actorId, params) => {
    const title = typeof params.title === 'string' ? params.title.trim() : '';
    if (!title) {
      return {
        success: false,
        error: 'A site needs a title. Ask the user what it should be called.',
      };
    }

    // A model that has to invent a subdomain invents a bad one. Deriving it
    // from the title is right far more often, and the user confirms either way.
    const rawSlug = typeof params.slug === 'string' ? params.slug.trim() : '';
    const slug = rawSlug || slugFromTitle(title);

    const requestedKind = typeof params.kind === 'string' ? params.kind : '';
    const kind = (CAT_SITE_KINDS as readonly string[]).includes(requestedKind)
      ? (requestedKind as CatSiteKind)
      : 'product';

    const outcome = await requestFleetCrownSite({ actorId, slug, title, kind });
    if (!outcome.ok) {
      return { success: false, error: outcome.reason };
    }

    return {
      success: true,
      data: {
        host: outcome.host,
        url: outcome.url,
        commandId: outcome.commandId,
        // Read by the model, so it is phrased as the sentence to say rather
        // than as a status another layer would have to translate.
        status: `A build was STARTED for ${outcome.host}. It is queued and takes a few minutes — the site is NOT up yet. Tell the user the build has started, give them ${outcome.url} as the address it will appear at, and do not describe any content, because none exists.`,
      },
    };
  },
};

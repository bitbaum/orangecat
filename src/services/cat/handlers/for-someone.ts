/**
 * Setting something up for a person who is not here — and handing it on.
 *
 * ADR-0005's last step ("Cat's verb"). `create_project_for_person` does in one
 * confirmation what the create form does with "This is for: someone else":
 * a placeholder actor for the person, a real project owned by HER (not by the
 * user talking to Cat), and the link the user sends her to take it over.
 * Nothing owned by a placeholder can receive money until she does — that is
 * enforced by the database, not by this handler.
 *
 * `send_to_fleetcrown` mints the signed handoff that the entity page's card
 * mints, so "can she have it built?" is answered with a link instead of a
 * tour of the project page.
 */

import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { STATUS } from '@/config/database-constants';
import { ROUTES } from '@/config/routes';
import { SITE_URL } from '@/config/brand';
import { createProfileClaim, declineProfileClaim } from '@/domain/profileClaims/service';
import { createFleetCrownHandoff } from '@/services/fleetcrown/handoff';
import { getTableName } from '@/config/entity-registry';
import { looseClient } from '@/lib/supabase/untyped';
import type { ActionHandler } from './types';

/**
 * Entity types with a public page a builder can be pointed at. Named routes,
 * not `publicBasePath`, so the route auditor can prove each one exists.
 */
const CHAT_HANDOFF_VIEW: Partial<Record<string, (id: string) => string>> = {
  project: ROUTES.PROJECTS.VIEW,
  product: ROUTES.PRODUCTS.VIEW,
  service: ROUTES.SERVICES.VIEW,
  cause: ROUTES.CAUSES.VIEW,
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export const forSomeoneHandlers: Record<string, ActionHandler> = {
  create_project_for_person: async (supabase, userId, _actorId, params) => {
    const personName = text(params.person_name);
    const title = text(params.title);
    if (!personName) {
      return { success: false, error: 'person_name is required — who is this for?' };
    }
    if (!title) {
      return { success: false, error: 'title is required — what is the project called?' };
    }

    const bio = text(params.person_bio) || undefined;
    const website = text(params.person_website) || undefined;
    const claim = await createProfileClaim({
      createdBy: userId,
      draft: { kind: 'person', profile: { name: personName, bio, website } },
    });
    if (!claim.ok) {
      return {
        success: false,
        error: 'message' in claim ? claim.message : 'Could not set up a page for this person',
      };
    }

    const goalAmount =
      typeof params.goal_btc === 'number' && params.goal_btc > 0 ? params.goal_btc : null;
    // Always visible: the whole point of setting a page up for someone is that
    // it exists and says whose it is (ADR-0005 D4). There used to be a
    // `publish` parameter defaulting to true; the free model passed false
    // unprompted, the page was a draft nobody could see, and her profile read
    // "Projects 0" after she claimed it (walked live 2026-09-11). The steward
    // can still unpublish from the page.
    const status = STATUS.PROJECTS.ACTIVE;

    const { data, error } = await supabase
      .from(ENTITY_REGISTRY.project.tableName)
      .insert({
        user_id: userId, // who set it up — stays as the attribution after the claim
        actor_id: claim.data.actorId, // who it belongs to
        title,
        description: text(params.description) || null,
        goal_amount: goalAmount,
        currency: 'BTC',
        category: text(params.category) || null,
        status,
      })
      .select('id')
      .single();

    if (error || !data) {
      // No project means no page worth sharing; take the placeholder down
      // again rather than leave a person's name on an empty claim.
      await declineProfileClaim(claim.data.token);
      return { success: false, error: error?.message ?? 'Could not create the project' };
    }

    const claimUrl = `${SITE_URL}${ROUTES.CLAIM(claim.data.token)}`;
    const shareUrl = `${SITE_URL}${ROUTES.DASHBOARD.PROFILE_CLAIMS_SHARE(claim.data.id)}`;
    const pageUrl = `${SITE_URL}${ROUTES.PROJECTS.VIEW(data.id as string)}`;
    return {
      success: true,
      data: {
        projectId: data.id,
        claimId: claim.data.id,
        actorId: claim.data.actorId,
        personName,
        title,
        status,
        claimUrl,
        shareUrl,
        pageUrl,
        url: shareUrl,
        displayMessage: `🎁 "${title}" is set up for ${personName} — send ${personName} the link to take it over`,
      },
    };
  },

  send_to_fleetcrown: async (supabase, userId, actorId, params) => {
    const entityType = text(params.entity_type) || 'project';
    let entityId = text(params.entity_id);
    const title = text(params.title);

    // The model usually knows the title, not the id. Resolve among rows the
    // caller created (user_id — the steward of a page set up for someone else)
    // or owns (actor_id — the person after she claimed it); the handoff
    // service re-checks the right to hand it over either way.
    if (!entityId && title) {
      const meta = ENTITY_REGISTRY[entityType as keyof typeof ENTITY_REGISTRY];
      if (!meta) {
        return { success: false, error: `Unknown entity type "${entityType}"` };
      }
      const titleColumn = meta.titleColumn ?? 'title';
      const { data: rows } = await looseClient(supabase)
        .from(getTableName(entityType as keyof typeof ENTITY_REGISTRY))
        .select(`id, ${titleColumn}`)
        .or(`user_id.eq.${userId},actor_id.eq.${actorId}`)
        .ilike(titleColumn, `%${title.replace(/[%_]/g, '')}%`)
        .order('created_at', { ascending: false })
        .limit(2);
      if (!rows || rows.length === 0) {
        return { success: false, error: `No ${entityType} of yours matches "${title}"` };
      }
      if (rows.length > 1) {
        return {
          success: false,
          error: `More than one ${entityType} matches "${title}" — give the exact title or id`,
        };
      }
      entityId = String((rows[0] as unknown as Record<string, unknown>).id);
    }
    if (!entityId) {
      return { success: false, error: 'entity_id or title is required' };
    }

    const view = CHAT_HANDOFF_VIEW[entityType];
    if (!view) {
      return {
        success: false,
        error: `From chat, only ${Object.keys(CHAT_HANDOFF_VIEW).join('/')} can be handed to FleetCrown`,
      };
    }
    const viewPath = view(entityId);
    const result = await createFleetCrownHandoff({
      supabase,
      userId,
      entityType,
      entityId,
      sourcePath: viewPath,
    });
    if (!result.ok) {
      return { success: false, error: result.message };
    }
    return {
      success: true,
      data: {
        url: result.url,
        expiresInSeconds: result.expiresInSeconds,
        title: result.title,
        role: result.role,
        displayMessage: `🛠 FleetCrown handoff for "${result.title}" is ready — open it within 10 minutes`,
      },
    };
  },
};

/**
 * Entity CREATE handlers — one per creatable entity type.
 *
 * Split from entities.ts (which exceeded the 500-line service limit) along the
 * natural seam: making new things here, changing existing ones in
 * entities-manage.ts. Both are re-exported by entities.ts as one map.
 */

import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { STATUS, ENTITY_STATUS } from '@/config/database-constants';
import { EVENT_TYPES } from '@/config/events';
import { z } from 'zod';
import {
  commitPreregistration,
  decidePreregistration,
  openScienceFields,
} from '@/domain/research/openScience';
import { createResearchReview, reviewInputSchema } from '@/domain/research/reviews';
import { getUserActorId } from '@/domain/actors';
import type { ActionHandler } from './types';

const catOpenScienceSchema = z.object(openScienceFields);

/**
 * The Cat reviews through the same domain call as the page, so self-review,
 * unlisted outputs and thin bodies are refused with the same words.
 */
const reviewResearch: ActionHandler = async (supabase, userId, _actorId, params) => {
  const parsed = reviewInputSchema.safeParse({
    verdict: params.verdict,
    body: params.body,
    output_link: params.output_link ?? null,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map(i => i.message).join('; ') };
  }
  // A review is signed by the PERSON, even when the Cat is acting in a group's
  // context: the insert policy only accepts the caller's own actor.
  const reviewerActorId = await getUserActorId(supabase, userId);
  if (!reviewerActorId) {
    return { success: false, error: 'No profile to sign the review with' };
  }
  const researchId = String(params.research_id ?? '');
  const result = await createResearchReview(
    supabase,
    researchId,
    userId,
    reviewerActorId,
    parsed.data
  );
  if (!result.ok) {
    return { success: false, error: result.message };
  }
  return {
    success: true,
    data: { ...result.review, displayMessage: `🔎 Review posted (${parsed.data.verdict})` },
  };
};

export const entityCreateHandlers: Record<string, ActionHandler> = {
  review_research: reviewResearch,

  create_product: async (supabase, userId, actorId, params) => {
    // DB column is `price` (numeric), not `price_btc`
    const price = (params.price_btc as number | null) ?? (params.price as number | null) ?? null;

    const { data, error } = await supabase
      .from(ENTITY_REGISTRY.product.tableName)
      .insert({
        user_id: userId,
        actor_id: actorId,
        title: params.title,
        description: params.description || null,
        price,
        currency: 'BTC',
        product_type: 'physical',
        images: [],
        fulfillment_type: 'manual',
        category: params.category || null,
        status: params.publish ? STATUS.PRODUCTS.ACTIVE : STATUS.PRODUCTS.DRAFT,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    const title = params.title as string;
    const statusLabel = params.publish ? 'live' : 'draft';
    return {
      success: true,
      data: { ...data, displayMessage: `🛍️ Product "${title}" created (${statusLabel})` },
    };
  },

  create_ai_assistant: async (supabase, userId, actorId, params) => {
    const title = params.title as string;
    const systemPrompt = (params.system_prompt as string) || '';
    if (!title || !systemPrompt) {
      return { success: false, error: 'An AI assistant needs a name and a system prompt.' };
    }
    // ai_assistants requires both user_id and actor_id (both NOT NULL).
    const { data, error } = await supabase
      .from(ENTITY_REGISTRY.ai_assistant.tableName)
      .insert({
        user_id: userId,
        actor_id: actorId,
        title,
        description: params.description || null,
        system_prompt: systemPrompt,
        category: params.category || null,
        pricing_model: (params.pricing_model as string) || 'per_message',
        status: params.publish ? STATUS.AI_ASSISTANTS.ACTIVE : STATUS.AI_ASSISTANTS.DRAFT,
        is_public: !!params.publish,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    const statusLabel = params.publish ? 'live' : 'draft';
    return {
      success: true,
      data: { ...data, displayMessage: `🤖 AI assistant "${title}" created (${statusLabel})` },
    };
  },

  create_service: async (supabase, userId, actorId, params) => {
    // DB columns are `hourly_rate` and `fixed_price` (no _btc suffix)
    const priceField = params.hourly_rate
      ? { hourly_rate: params.hourly_rate as number }
      : params.fixed_price
        ? { fixed_price: params.fixed_price as number }
        : params.hourly_rate_btc
          ? { hourly_rate: params.hourly_rate_btc }
          : { fixed_price: params.fixed_price_btc ?? params.price_btc ?? null };

    const { data, error } = await supabase
      .from(ENTITY_REGISTRY.service.tableName)
      .insert({
        user_id: userId,
        actor_id: actorId,
        title: params.title,
        description: params.description || null,
        ...priceField,
        currency: 'BTC',
        duration_minutes: params.duration_minutes || null,
        service_location_type: 'remote',
        images: [],
        portfolio_links: [],
        status: params.publish ? STATUS.SERVICES.ACTIVE : STATUS.SERVICES.DRAFT,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    const title = params.title as string;
    const statusLabel = params.publish ? 'live' : 'draft';
    return {
      success: true,
      data: { ...data, displayMessage: `🔧 Service "${title}" created (${statusLabel})` },
    };
  },

  create_project: async (supabase, userId, actorId, params) => {
    // DB columns are `goal_amount` + `currency`, not `goal_btc`
    const goalAmount =
      (params.goal_btc as number | null) ?? (params.goal_amount as number | null) ?? null;

    const { data, error } = await supabase
      .from(ENTITY_REGISTRY.project.tableName)
      .insert({
        user_id: userId,
        actor_id: actorId,
        title: params.title,
        description: params.description || null,
        goal_amount: goalAmount,
        currency: 'BTC',
        category: params.category || null,
        status: params.publish ? STATUS.PROJECTS.ACTIVE : STATUS.PROJECTS.DRAFT,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    const title = params.title as string;
    const statusLabel = params.publish ? 'live' : 'draft';
    return {
      success: true,
      data: { ...data, displayMessage: `🚀 Project "${title}" created (${statusLabel})` },
    };
  },

  create_cause: async (supabase, userId, actorId, params) => {
    // DB column is `cause_category` (not `category`); target_amount is the funding goal
    const targetAmount =
      (params.goal_btc as number | null) ??
      (params.target_amount as number | null) ??
      (params.goal_amount as number | null) ??
      null;
    const { data, error } = await supabase
      .from(ENTITY_REGISTRY.cause.tableName)
      .insert({
        user_id: userId,
        actor_id: actorId,
        title: params.title,
        description: params.description || null,
        cause_category:
          (params.cause_category as string | null) ?? (params.category as string | null) ?? null,
        target_amount: targetAmount,
        currency: 'BTC',
        status: params.publish ? STATUS.CAUSES.ACTIVE : STATUS.CAUSES.DRAFT,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    const title = params.title as string;
    const statusLabel = params.publish ? 'live' : 'draft';
    return {
      success: true,
      data: { ...data, displayMessage: `❤️ Cause "${title}" created (${statusLabel})` },
    };
  },

  create_event: async (supabase, userId, actorId, params) => {
    // `events` has no `location` column — the place is `venue_address` — and
    // its `currency` default ('SATS') fails the table's own CHECK. Both used to
    // be left to the database, so every event the Cat created was refused.
    const eventType = EVENT_TYPES.some(t => t.value === params.event_type)
      ? (params.event_type as string)
      : 'meetup';
    const location = typeof params.location === 'string' ? params.location.trim() : '';
    const maxAttendees = Number(params.max_attendees);
    const { data, error } = await supabase
      .from(ENTITY_REGISTRY.event.tableName)
      .insert({
        user_id: userId,
        actor_id: actorId,
        title: params.title,
        description: params.description || null,
        event_type: eventType,
        start_date: params.start_date,
        end_date: params.end_date || null,
        venue_address: location || null,
        is_free: params.is_free !== false,
        max_attendees: Number.isInteger(maxAttendees) && maxAttendees > 0 ? maxAttendees : null,
        currency: 'BTC',
        status: params.publish ? STATUS.EVENTS.PUBLISHED : STATUS.EVENTS.DRAFT,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    const title = params.title as string;
    const statusLabel = params.publish ? 'live' : 'draft';
    return {
      success: true,
      data: { ...data, displayMessage: `📅 Event "${title}" created (${statusLabel})` },
    };
  },

  create_asset: async (supabase, _userId, actorId, params) => {
    const { data, error } = await supabase
      .from(ENTITY_REGISTRY.asset.tableName)
      .insert({
        actor_id: actorId,
        title: params.title,
        description: params.description || null,
        type: params.asset_type || null,
        location: params.location || null,
        currency: 'BTC',
        verification_status: 'unverified',
        public_visibility: false,
        status: params.publish ? STATUS.ASSETS.ACTIVE : STATUS.ASSETS.DRAFT,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    const title = params.title as string;
    return { success: true, data: { ...data, displayMessage: `🏠 Asset "${title}" registered` } };
  },

  create_investment: async (supabase, _userId, actorId, params) => {
    // DB columns: target_amount + currency (not target_amount_btc), minimum_investment.
    // Published investments use status='open' (not 'active') per investments status enum.
    const targetAmount =
      (params.target_amount_btc as number | null) ??
      (params.target_amount as number | null) ??
      null;
    const minimumInvestment =
      (params.minimum_investment_btc as number | null) ??
      (params.minimum_investment as number | null) ??
      0.0001;

    const { data, error } = await supabase
      .from(ENTITY_REGISTRY.investment.tableName)
      .insert({
        actor_id: actorId,
        title: params.title,
        description: params.description || null,
        investment_type: (params.investment_type as string) || 'revenue_share',
        target_amount: targetAmount,
        minimum_investment: minimumInvestment,
        currency: 'BTC',
        total_raised: 0,
        is_public: Boolean(params.publish),
        status: params.publish ? STATUS.INVESTMENTS.OPEN : STATUS.INVESTMENTS.DRAFT,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    const title = params.title as string;
    const statusLabel = params.publish ? 'open' : 'draft';
    return {
      success: true,
      data: { ...data, displayMessage: `📈 Investment "${title}" created (${statusLabel})` },
    };
  },

  create_loan: async (supabase, userId, actorId, params) => {
    // Loans table has actor_id + user_id; amount_btc maps to original_amount
    // and remaining_balance (both NUMERIC BTC).
    const amountBtc = (params.amount_btc as number) ?? 0;

    const { data, error } = await supabase
      .from(ENTITY_REGISTRY.loan.tableName)
      .insert({
        actor_id: actorId,
        user_id: userId,
        title: params.title,
        description: params.description || null,
        loan_type: (params.loan_type as string) || 'new_request',
        original_amount: amountBtc,
        remaining_balance: amountBtc,
        currency: 'BTC',
        interest_rate: (params.interest_rate as number | undefined) ?? null,
        fulfillment_type: 'manual',
        status: STATUS.LOANS.ACTIVE,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    const title = params.title as string;
    const rateNote = params.interest_rate ? ` at ${params.interest_rate}% interest` : '';
    return {
      success: true,
      data: { ...data, displayMessage: `💰 Loan request "${title}" created${rateNote}` },
    };
  },

  create_wishlist: async (supabase, _userId, actorId, params) => {
    const { data, error } = await supabase
      .from(ENTITY_REGISTRY.wishlist.tableName)
      .insert({
        actor_id: actorId,
        title: params.title,
        description: (params.description as string | null) || null,
        type: (params.type as string) || 'general',
        visibility: (params.visibility as string) || 'public',
        is_active: true,
        event_date: (params.event_date as string | null) || null,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    const title = params.title as string;
    return { success: true, data: { ...data, displayMessage: `🎁 Wishlist "${title}" created` } };
  },

  create_research: async (supabase, userId, _actorId, params) => {
    // research_entities uses user_id (references profiles), NOT actor_id
    // Many NOT NULL fields require sensible defaults when the Cat caller omits them.
    const fundingGoalBtc =
      (params.funding_goal_btc as number | null) ?? (params.funding_goal as number | null) ?? 0.001;

    // Same rules as the form and the API: an invalid link or licence is refused
    // with the reason, never silently dropped.
    const open = catOpenScienceSchema.safeParse({
      license: params.license ?? 'CC-BY-4.0',
      output_links: params.output_links ?? [],
      preregistration: params.preregistration ?? null,
    });
    if (!open.success) {
      return { success: false, error: open.error.issues.map(i => i.message).join('; ') };
    }
    const prereg = decidePreregistration(open.data.preregistration, null);

    const { data, error } = await supabase
      .from(ENTITY_REGISTRY.research.tableName)
      .insert({
        user_id: userId,
        title: params.title,
        description: params.description || null,
        field: (params.field as string) || 'other',
        methodology: (params.methodology as string) || 'experimental',
        expected_outcome:
          (params.expected_outcome as string) || (params.description as string) || '',
        timeline: (params.timeline as string) || 'medium_term',
        funding_goal_btc: fundingGoalBtc,
        funding_raised_btc: 0,
        funding_model: (params.funding_model as string) || 'donation',
        wallet_address: null,
        lead_researcher: (params.lead_researcher as string) || '',
        team_members: [],
        open_collaboration: true,
        resource_needs: [],
        progress_frequency: (params.progress_frequency as string) || 'monthly',
        transparency_level: (params.transparency_level as string) || 'progress',
        voting_enabled: true,
        impact_areas: [],
        target_audience: [],
        sdg_alignment: [],
        status: ENTITY_STATUS.DRAFT,
        is_public: true,
        is_featured: false,
        license: open.data.license ?? null,
        output_links: open.data.output_links ?? [],
        ...(prereg.kind === 'commit' ? await commitPreregistration(prereg.text) : {}),
        // Denormalized counter columns were dropped in migration
        // 20260404000005 — inserting them breaks live.
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    const resTitle = params.title as string;
    const field = params.field ? ` [${params.field}]` : '';
    return {
      success: true,
      data: { ...data, displayMessage: `🔬 Research "${resTitle}"${field} created` },
    };
  },

  create_circle: async (supabase, _userId, actorId, params) => {
    const { data, error } = await supabase
      .from(ENTITY_REGISTRY.circle.tableName)
      .insert({
        actor_id: actorId,
        title: params.title,
        description: params.description || null,
        category: (params.category as string | null) ?? null,
        visibility: (params.visibility as string | null) ?? 'public',
        status: params.publish ? 'active' : 'draft',
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    const title = params.title as string;
    const statusLabel = params.publish ? 'live' : 'draft';
    return {
      success: true,
      data: { ...data, displayMessage: `⭕ Circle "${title}" created (${statusLabel})` },
    };
  },
};

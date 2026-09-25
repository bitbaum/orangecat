/**
 * Proactive nudges — the Cat working for you in the background.
 *
 * Generates specific, GROUNDED, actionable suggestions per user:
 *  - completion:  deterministic gaps → add a bio, publish a draft
 *  - growth:      a skill/asset they HAVE but haven't listed → one-tap prefilled draft,
 *                 preferring (and flagging) ones real platform demand is asking for
 *
 * Trust rules (founder-verified):
 *  - Names are always entity display titles — never raw URLs or slugs.
 *  - One language per user (profile.language / currency heuristic) across ALL copy.
 *  - Every nudge is grounded in the user's actual entities, profile, and economic
 *    profile.
 *
 * All rule-based. The LLM-reasoned kinds (activation, connection) were removed
 * 2026-09-25: this runs when the dashboard MOUNTS (GET /api/cat/nudges) and
 * from the weekly-digest cron, so they spent the shared free model pool — and
 * embedded the user's bio — with nobody asking. Standing rule: a free-tier key
 * is spent only when a person deliberately asks. The same suggestions are one
 * question away in the Cat chat. `nudge_type` keeps the old values because
 * cached user_nudges rows still carry them.
 * Results are cached in user_nudges; dismissed ones never reappear (dedupe_key).
 */

import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ROUTES } from '@/config/routes';
import { NUDGE_COPY, resolveNudgeLanguage, type NudgeCopy } from './nudge-copy';
import {
  getEconomicProfile,
  suggestedEntityForSkill,
  type EconomicProfile,
} from './economic-profile';
import { logger } from '@/utils/logger';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { getUserActorId } from '@/domain/actors';

export interface Nudge {
  nudge_type: 'activation' | 'connection' | 'completion' | 'growth';
  title: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  dedupe_key: string;
  score: number;
}

const ENTITY_SOURCE: Array<{ type: 'product' | 'service' | 'cause' }> = [
  { type: 'product' },
  { type: 'service' },
  { type: 'cause' },
];

export async function generateNudges(
  supabase: AnySupabaseClient,
  userId: string
): Promise<Nudge[]> {
  const { data: profile } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('id, username, name, bio, background, location_city, language, currency')
    .eq('id', userId)
    .maybeSingle();
  if (!profile?.username) {
    return [];
  }

  const copy = NUDGE_COPY[resolveNudgeLanguage(profile)];
  const nudges: Nudge[] = [];

  // ── User's own entities (active + drafts) ──────────────────────────────────
  const ownActorId = await getUserActorId(supabase, userId);
  const actor = ownActorId ? { id: ownActorId } : null;
  const created: Record<string, { active: number; drafts: Array<{ id: string; title: string }> }> =
    {};
  if (actor?.id) {
    // One query per entity type, fired in parallel — this endpoint is
    // force-dynamic, so serial queries here directly slow every dashboard load
    const results = await Promise.all(
      ENTITY_SOURCE.map(async ({ type }) => {
        const meta = ENTITY_REGISTRY[type];
        const { data } = await supabase
          .from(meta.tableName)
          .select('id, title, status')
          .eq('actor_id', actor.id);
        return { type, data: data ?? [] };
      })
    );
    for (const { type, data } of results) {
      created[type] = {
        active: data.filter((e: any) => e.status === 'active').length,
        drafts: data
          .filter((e: any) => e.status === 'draft')
          .map((e: any) => ({ id: e.id, title: e.title })),
      };
    }
  }

  // ── Completion nudges (deterministic) ──────────────────────────────────────
  if (!profile.bio) {
    nudges.push({
      nudge_type: 'completion',
      title: copy.completionBio.title,
      body: copy.completionBio.body,
      cta_label: copy.completionBio.cta,
      cta_url: ROUTES.DASHBOARD.INFO_EDIT,
      dedupe_key: 'completion:bio',
      score: 0.6,
    });
  }
  for (const { type } of ENTITY_SOURCE) {
    for (const d of created[type]?.drafts ?? []) {
      const c = copy.publishDraft(d.title);
      nudges.push({
        nudge_type: 'completion',
        title: c.title,
        body: c.body,
        cta_label: c.cta,
        cta_url: ENTITY_REGISTRY[type].basePath,
        dedupe_key: `completion:publish:${d.id}`,
        score: 0.7,
      });
    }
  }

  // ── Growth nudges (deterministic, grounded in the economic profile) ─────────
  let econ: EconomicProfile | null = null;
  if (actor?.id) {
    try {
      econ = await getEconomicProfile(supabase, userId);
      if (econ) {
        nudges.push(...(await growthNudges(supabase, actor.id, econ, copy)));
      }
    } catch (err) {
      logger.warn('nudges: growth generation failed', { err }, 'Nudges');
    }
  }

  // rank, dedupe, cap
  const seen = new Set<string>();
  return nudges
    .sort((a, b) => b.score - a.score)
    .filter(n => (seen.has(n.dedupe_key) ? false : (seen.add(n.dedupe_key), true)))
    .slice(0, 5);
}

/** Stem-aware substring match — conservative, so a "match" is a real signal. */
function termMatches(term: string, haystack: string[]): boolean {
  const x = term.toLowerCase().trim();
  if (!x || haystack.length === 0) {
    return false;
  }
  const stem = x.slice(0, Math.max(4, Math.round(x.length * 0.6)));
  return haystack.some(h => h.includes(x) || h.includes(stem));
}

/**
 * Real platform DEMAND, lowercased — what people here are actually asking for.
 * Sourced from committed SEARCH queries (the strongest signal — what people look for)
 * plus PUBLIC wishlists + their items. Returns [] when there's nothing — in which case
 * growth nudges fall back to plain "you haven't listed this" copy and never claim demand.
 */
async function gatherPlatformDemand(supabase: AnySupabaseClient): Promise<string[]> {
  const out: string[] = [];
  try {
    const { data: lists } = await supabase
      .from(DATABASE_TABLES.WISHLISTS)
      .select('id, title, description')
      .eq('visibility', 'public')
      .limit(100);
    const ids: string[] = [];
    for (const w of lists ?? []) {
      if (w?.title) {
        out.push(String(w.title).toLowerCase());
      }
      if (w?.description) {
        out.push(String(w.description).toLowerCase());
      }
      if (w?.id) {
        ids.push(w.id);
      }
    }
    if (ids.length) {
      const { data: items } = await supabase
        .from(DATABASE_TABLES.WISHLIST_ITEMS)
        .select('title, description, wishlist_id')
        .in('wishlist_id', ids)
        .limit(300);
      for (const it of items ?? []) {
        if (it?.title) {
          out.push(String(it.title).toLowerCase());
        }
        if (it?.description) {
          out.push(String(it.description).toLowerCase());
        }
      }
    }
  } catch (err) {
    logger.warn('nudges: demand gather failed', { err }, 'Nudges');
  }
  // Committed searches — the strongest demand signal (what people actively look for).
  try {
    const { data: searches } = await supabase
      .from(DATABASE_TABLES.SEARCH_QUERIES)
      .select('query')
      .order('created_at', { ascending: false })
      .limit(500);
    for (const s of searches ?? []) {
      if (s?.query) {
        out.push(String(s.query).toLowerCase());
      }
    }
  } catch (err) {
    logger.warn('nudges: search-demand gather failed', { err }, 'Nudges');
  }
  return out;
}

/**
 * Growth nudges: a skill or asset the user HAS but hasn't listed yet → the smallest
 * publishable next step, deep-linked to a PREFILLED create form (one tap, no template
 * picker). Deterministic and grounded — only their real, stated skills/assets, only
 * when nothing active already covers them. DEMAND-GROUNDED: a skill/asset that matches
 * real platform demand (public wishlists) is preferred and ranked higher, and its copy
 * says so; with no demand evidence it falls back to plain copy (never invents demand).
 * Capped to one skill + one asset so it inspires rather than nags.
 */
async function growthNudges(
  supabase: AnySupabaseClient,
  actorId: string,
  econ: EconomicProfile,
  copy: NudgeCopy
): Promise<Nudge[]> {
  if (econ.skills.length === 0 && econ.assets.length === 0) {
    return [];
  }
  // What this user already offers, so we never suggest listing something they list.
  const ownTitles: string[] = [];
  for (const type of ['service', 'product', 'asset'] as const) {
    const { data } = await supabase
      .from(ENTITY_REGISTRY[type].tableName)
      .select('title, status')
      .eq('actor_id', actorId)
      .eq('status', 'active');
    for (const r of data ?? []) {
      if (r?.title) {
        ownTitles.push(String(r.title).toLowerCase());
      }
    }
  }
  const covered = (term: string) => term.trim() === '' || termMatches(term, ownTitles);

  const demand = await gatherPlatformDemand(supabase);
  const wanted = (term: string) => termMatches(term, demand);

  const out: Nudge[] = [];

  // Prefer an uncovered skill that real demand is asking for; else the first uncovered.
  const uncoveredSkills = econ.skills.map(s => s.name).filter(n => n && !covered(n));
  const skill = uncoveredSkills.find(wanted) ?? uncoveredSkills[0];
  if (skill) {
    const isWanted = wanted(skill);
    const et = suggestedEntityForSkill(skill);
    const meta = ENTITY_REGISTRY[et];
    const c = copy.growthSkill({
      skill,
      noun: copy.entityNoun(et),
      kind: et,
      wanted: isWanted,
    });
    out.push({
      nudge_type: 'growth',
      title: c.title,
      body: c.body,
      cta_label: c.cta,
      cta_url: `${meta.createPath}?title=${encodeURIComponent(skill)}`,
      dedupe_key: `growth:skill:${skill.toLowerCase()}`,
      score: isWanted ? 0.88 : 0.82,
    });
  }

  const uncoveredAssets = econ.assets.map(a => a.name).filter(n => n && !covered(n));
  const asset = uncoveredAssets.find(wanted) ?? uncoveredAssets[0];
  if (asset) {
    const isWanted = wanted(asset);
    const c = copy.growthAsset({ asset, wanted: isWanted });
    out.push({
      nudge_type: 'growth',
      title: c.title,
      body: c.body,
      cta_label: c.cta,
      cta_url: `${ENTITY_REGISTRY.asset.createPath}?title=${encodeURIComponent(asset)}`,
      dedupe_key: `growth:asset:${asset.toLowerCase()}`,
      score: isWanted ? 0.86 : 0.8,
    });
  }

  return out;
}

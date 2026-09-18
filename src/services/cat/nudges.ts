/**
 * Proactive nudges — the Cat working for you in the background.
 *
 * Generates specific, GROUNDED, actionable suggestions per user:
 *  - activation:  bio implies an offering they haven't created → "Publish a … service"
 *  - connection:  a real, semantically-related person → "You should meet X"
 *  - completion:  deterministic gaps → add a bio, publish a draft
 *  - growth:      a skill/asset they HAVE but haven't listed → one-tap prefilled draft,
 *                 preferring (and flagging) ones real platform demand is asking for
 *
 * Trust rules (founder-verified):
 *  - Names are always entity display titles — never raw URLs or slugs.
 *  - One language per user (profile.language / currency heuristic) across ALL copy.
 *  - Every nudge is grounded in the user's actual entities, profile, and economic
 *    profile — LLM proposals that don't overlap that grounding are dropped
 *    (the "haircuts to a ceramicist" bug).
 *
 * Activation + connection are LLM-reasoned; completion + growth are rule-based.
 * Results are cached in user_nudges; dismissed ones never reappear (dedupe_key).
 */

import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ROUTES } from '@/config/routes';
import { DEFAULT_FREE_MODEL_ID } from '@/config/ai-models';
import { createOpenRouterService } from '@/services/ai';
import { searchPlatform } from './platform-search';
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

// Entity types the Cat may proactively suggest creating.
const SUGGESTABLE = new Set(['service', 'product', 'project', 'cause', 'event', 'wishlist']);
const ENTITY_SOURCE: Array<{ type: 'product' | 'service' | 'cause' }> = [
  { type: 'product' },
  { type: 'service' },
  { type: 'cause' },
];

const usernameFromUrl = (url: string): string | null => {
  const m = url.match(/^\/profiles\/(.+)$/);
  return m ? m[1] : null;
};

/** True when a string is a URL/path/slug — never acceptable as a display name. */
const looksLikeUrl = (s: string): boolean =>
  /^https?:\/\//i.test(s) || s.startsWith('/') || /\.[a-z]{2,}(\/|$)/i.test(s);

interface NeighborPerson {
  username: string;
  /** Always a real display name (profile name or username) — never a URL. */
  title: string;
  description: string;
}

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
  const ownEntityTitles: string[] = [];
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
      for (const e of data) {
        if (e?.title) {
          ownEntityTitles.push(String(e.title).toLowerCase());
        }
      }
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

  // ── Smart nudges (activation + connection), only with a bio to reason from ──
  if (profile.bio) {
    let neighbors: NeighborPerson[] = [];
    try {
      const results = await searchPlatform(
        supabase,
        `${profile.name ?? ''} ${profile.bio}`,
        'people'
      );
      neighbors = results
        .map(r => ({
          username: usernameFromUrl(r.url) ?? '',
          title: r.title,
          description: r.description,
        }))
        .filter(n => n.username && n.username !== profile.username)
        .slice(0, 4);
      neighbors = await resolveNeighborNames(supabase, neighbors);
    } catch (err) {
      logger.warn('nudges: neighbor search failed', { err }, 'Nudges');
    }

    try {
      const smart = await smartNudges(profile, created, neighbors, econ, ownEntityTitles, copy);
      nudges.push(...smart);
    } catch (err) {
      logger.warn('nudges: smart generation failed', { err }, 'Nudges');
    }
  }

  // rank, dedupe, cap
  const seen = new Set<string>();
  return nudges
    .sort((a, b) => b.score - a.score)
    .filter(n => (seen.has(n.dedupe_key) ? false : (seen.add(n.dedupe_key), true)))
    .slice(0, 5);
}

/**
 * Guarantee neighbor names are DISPLAY TITLES: look each username up in profiles
 * and use name → username. Search-result titles have rendered raw URLs/slugs as
 * people's names on suggestion cards (founder-verified); never trust them alone.
 */
async function resolveNeighborNames(
  supabase: AnySupabaseClient,
  neighbors: NeighborPerson[]
): Promise<NeighborPerson[]> {
  if (neighbors.length === 0) {
    return neighbors;
  }
  const names = new Map<string, string>();
  try {
    const { data } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('username, name')
      .in(
        'username',
        neighbors.map(n => n.username)
      );
    for (const row of data ?? []) {
      if (row?.username) {
        names.set(row.username, row.name || row.username);
      }
    }
  } catch (err) {
    logger.warn('nudges: neighbor name resolve failed', { err }, 'Nudges');
  }
  return neighbors.map(n => {
    const resolved = names.get(n.username);
    const safe = resolved ?? (n.title && !looksLikeUrl(n.title) ? n.title : n.username);
    return { ...n, title: safe };
  });
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
 * The user's actual grounding: bio + background + economic profile terms + their
 * own entity titles, lowercased. LLM proposals must overlap this or they're stale
 * context (old chat scraps) and get dropped.
 */
function groundingCorpus(
  profile: { bio?: string | null; background?: string | null },
  econ: EconomicProfile | null,
  ownEntityTitles: string[]
): string[] {
  const corpus: string[] = [...ownEntityTitles];
  if (profile.bio) {
    corpus.push(String(profile.bio).toLowerCase());
  }
  if (profile.background) {
    corpus.push(String(profile.background).toLowerCase());
  }
  if (econ) {
    for (const s of econ.skills) {
      corpus.push(s.name.toLowerCase());
    }
    for (const a of econ.assets) {
      corpus.push(a.name.toLowerCase());
    }
    for (const w of econ.askedFor) {
      corpus.push(w.toLowerCase());
    }
  }
  return corpus.filter(Boolean);
}

/** True when the text shares at least one significant term with the corpus. */
function isGrounded(text: string, corpus: string[]): boolean {
  const tokens = text
    .toLowerCase()
    .split(/[^a-zà-öø-ÿäöüß0-9]+/i)
    .filter(t => t.length >= 4);
  return tokens.some(t => termMatches(t, corpus));
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

async function smartNudges(
  profile: any,
  created: Record<string, { active: number; drafts: Array<{ id: string; title: string }> }>,
  neighbors: NeighborPerson[],
  econ: EconomicProfile | null,
  ownEntityTitles: string[],
  copy: NudgeCopy
): Promise<Nudge[]> {
  const system = `You are the proactive engine of OrangeCat's Cat. Given a user's profile, what they've already created, their economic profile, and real people on the platform related to them, propose specific, GROUNDED nudges that help them succeed.

STRICT RULES:
- Ground everything in the data given. NEVER invent a skill they didn't state or a person not in the provided list.
- Two kinds of nudge:
  1. "activation" — if their bio or economic profile clearly implies an offering they have NOT already created, suggest creating ONE entity. entityType must be one of: service, product, project, cause, event, wishlist. Give a concrete title and a one-sentence reason.
  2. "connection" — suggest meeting ONE of the listed people, with a one-sentence reason tied to BOTH bios.
- Don't suggest creating an entity type they already have active. If nothing is genuinely useful, return [].
- Write every "title" and "reason" in ${copy.languageName} — the user's language. Never mix languages.

Return ONLY a JSON array (max 3), each item exactly:
{"type":"activation","entityType":"service","title":"<entity title>","reason":"<one sentence>"}
or {"type":"connection","username":"<one of the provided usernames>","reason":"<one sentence>"}`;

  const payload = {
    profile: { name: profile.name, bio: profile.bio, location: profile.location_city },
    economicProfile: econ
      ? {
          skills: econ.skills.map(s => s.name),
          assets: econ.assets.map(a => a.name),
          askedFor: econ.askedFor,
        }
      : null,
    alreadyCreated: Object.fromEntries(
      Object.entries(created).map(([k, v]) => [k, { active: v.active }])
    ),
    people: neighbors,
  };

  const ai = createOpenRouterService();
  const res = await ai.chatCompletion({
    model: DEFAULT_FREE_MODEL_ID,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(payload) },
    ],
    temperature: 0.4,
  });

  const raw = (res.content || '').replace(/```json\s*|\s*```/g, '').trim();
  let parsed: any[];
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }

  // Activation proposals must overlap the user's ACTUAL grounding (bio, background,
  // economic profile, own entities). A weak model reasoning from stale chat scraps
  // ("haircuts" for a ceramicist) fails this check and is dropped.
  const corpus = groundingCorpus(profile, econ, ownEntityTitles);

  const neighborUsernames = new Set(neighbors.map(n => n.username));
  const out: Nudge[] = [];
  for (const p of parsed) {
    if (p?.type === 'activation' && SUGGESTABLE.has(p.entityType) && p.title) {
      const meta = ENTITY_REGISTRY[p.entityType as keyof typeof ENTITY_REGISTRY];
      const proposedTitle = String(p.title).slice(0, 80);
      if (!meta || looksLikeUrl(proposedTitle)) {
        continue;
      }
      if (!isGrounded(`${proposedTitle} ${p.reason ?? ''}`, corpus)) {
        logger.info('nudges: dropped ungrounded activation', { title: proposedTitle }, 'Nudges');
        continue;
      }
      const c = copy.activation({
        title: proposedTitle,
        noun: copy.entityNoun(p.entityType as keyof typeof ENTITY_REGISTRY),
      });
      out.push({
        nudge_type: 'activation',
        title: c.title,
        body: String(p.reason || '').slice(0, 240),
        cta_label: c.cta,
        cta_url: meta.createPath,
        dedupe_key: `activation:${p.entityType}`,
        score: 0.85,
      });
    } else if (p?.type === 'connection' && neighborUsernames.has(p.username)) {
      const n = neighbors.find(x => x.username === p.username)!;
      const c = copy.connection(n.title);
      out.push({
        nudge_type: 'connection',
        title: c.title,
        body: String(p.reason || '').slice(0, 240),
        cta_label: c.cta,
        cta_url: `/profiles/${p.username}`,
        dedupe_key: `connection:${p.username}`,
        score: 0.8,
      });
    }
  }
  return out;
}

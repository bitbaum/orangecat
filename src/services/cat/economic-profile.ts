/**
 * User economic profile — the structured store of a user's latent economic value.
 *
 * The keystone of the economic agent (docs/specs/cat-economic-interviewer.md): a
 * typed home for what Cat learns by interviewing the user, so the offer engine,
 * gap-detection, and future matchmaking reason over a real model of the person
 * instead of two free-text fields. Read into Cat's context; written by the
 * interview/extraction layer.
 *
 * Every accessor degrades gracefully: if the table doesn't exist yet (migration
 * pending on the box) or a query fails, reads return null/empty and writes return
 * false — Cat keeps working, just without this signal.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';
import { looksLikeSelfDisclosure, selectForgetFacts, type MemoryAiService } from './memory';
import { ECON_EXTRACTION_SYSTEM } from './economic-profile-prompt';

export interface EconomicSkill {
  name: string;
  level?: string;
  years?: number;
}
export interface EconomicAsset {
  name: string;
  type?: string;
}
export type EconomicGoalKind = 'earn' | 'fund' | 'learn' | 'connect' | 'build';
export interface EconomicGoal {
  text: string;
  kind?: EconomicGoalKind;
}

export interface EconomicProfile {
  skills: EconomicSkill[];
  assets: EconomicAsset[];
  goals: EconomicGoal[];
  constraints: string[];
  /** The richest signal: what people come to this person for. */
  askedFor: string[];
  /**
   * Public — the inverse of `constraints`: work they explicitly say they are
   * NOT taking on right now (e.g. "full-time roles", "backend-only gigs").
   * Shown on the profile, unlike `constraints`/`motivation`/`stage` which stay
   * private. Lets advisory/fractional-role offers (e.g. "fractional CTO")
   * state scope up front instead of only what they do.
   */
  notAvailableFor: string[];
  motivation?: string | null;
  stage?: string | null;
}

/** The subset of an EconomicProfile that's ever shown to someone other than
 * the owner — served from user_economic_profile_public, which excludes the
 * private constraints/motivation/stage columns at the database layer. */
export type PublicEconomicProfile = Pick<
  EconomicProfile,
  'skills' | 'assets' | 'askedFor' | 'notAvailableFor'
>;

const EMPTY: EconomicProfile = {
  skills: [],
  assets: [],
  goals: [],
  constraints: [],
  askedFor: [],
  notAvailableFor: [],
  motivation: null,
  stage: null,
};

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/** True when the profile carries any latent-value signal at all. */
export function isEconomicProfileEmpty(p: EconomicProfile | null): boolean {
  if (!p) {
    return true;
  }
  return (
    p.skills.length === 0 &&
    p.assets.length === 0 &&
    p.goals.length === 0 &&
    p.constraints.length === 0 &&
    p.askedFor.length === 0 &&
    p.notAvailableFor.length === 0 &&
    !p.motivation &&
    !p.stage
  );
}

/**
 * SSOT for the economic dimensions, in the order Cat should probe them — "what
 * people ask them for" first (the richest signal), motivation last. Both the gap
 * list and the completeness score derive from this, so they can never drift.
 */
const ECONOMIC_DIMENSIONS: ReadonlyArray<{
  label: string;
  filled: (p: EconomicProfile) => boolean;
}> = [
  { label: 'what people come to them for', filled: p => p.askedFor.length > 0 },
  { label: 'skills', filled: p => p.skills.length > 0 },
  { label: 'assets they own that could earn', filled: p => p.assets.length > 0 },
  { label: 'goals', filled: p => p.goals.length > 0 },
  { label: 'constraints (time, capital)', filled: p => p.constraints.length > 0 },
  { label: 'what they want from being here', filled: p => !!p.motivation },
];

/** The dimensions still unknown — drives the proactive interview. */
export function economicProfileGaps(p: EconomicProfile | null): string[] {
  if (!p) {
    return ECONOMIC_DIMENSIONS.map(d => d.label);
  }
  return ECONOMIC_DIMENSIONS.filter(d => !d.filled(p)).map(d => d.label);
}

/**
 * How complete the economic picture is, 0–100 (deterministic, even-weighted across
 * the dimensions). Tells Cat how hard to lean into discovery and lets it frame
 * progress for the user ("you're X% of the way to a full picture").
 */
export function economicCompleteness(p: EconomicProfile | null): number {
  if (!p) {
    return 0;
  }
  const filled = ECONOMIC_DIMENSIONS.filter(d => d.filled(p)).length;
  return Math.round((filled / ECONOMIC_DIMENSIONS.length) * 100);
}

// Skill phrases that describe a sellable ARTIFACT (a thing you make once and sell
// many times) rather than time-for-hire. Everything else defaults to a service.
const PRODUCT_SKILL_HINTS = [
  'ebook',
  'e-book',
  'template',
  'preset',
  'course',
  'guide',
  'pattern',
  'sample pack',
  'print',
  'poster',
  'sticker',
  'kit',
  'plugin',
  'font',
  'stock photo',
  'recipe',
  'beat',
  'album',
  'artwork',
  'worksheet',
  'planner',
  'mockup',
  'lut',
];

/**
 * The entity type a skill most naturally becomes: a sellable artifact → product,
 * otherwise a service (time/expertise for hire — the common case). Deterministic;
 * lets the growth nudge open the RIGHT prefilled form instead of always a service.
 */
export function suggestedEntityForSkill(skill: string): 'service' | 'product' {
  const s = skill.toLowerCase();
  return PRODUCT_SKILL_HINTS.some(h => s.includes(h)) ? 'product' : 'service';
}

export async function getEconomicProfile(
  supabase: AnySupabaseClient,
  userId: string
): Promise<EconomicProfile | null> {
  try {
    const { data, error } = await supabase
      .from(DATABASE_TABLES.USER_ECONOMIC_PROFILE)
      .select('skills, assets, goals, constraints, asked_for, not_available_for, motivation, stage')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      // A query error (vs. an absent row) means the economic layer is degraded —
      // e.g. the table migration is lagging on the box. Left silent, this starves
      // nudges/offers and looks identical to "user hasn't filled it in". Signal it.
      logger.warn(
        'getEconomicProfile query failed — economic context will be empty (migration lag?)',
        { error },
        'EconomicProfile'
      );
      return null;
    }
    if (!data) {
      return null;
    }
    const row = data as Record<string, unknown>;
    return {
      skills: asArray<EconomicSkill>(row.skills),
      assets: asArray<EconomicAsset>(row.assets),
      goals: asArray<EconomicGoal>(row.goals),
      constraints: asArray<string>(row.constraints),
      askedFor: asArray<string>(row.asked_for),
      notAvailableFor: asArray<string>(row.not_available_for),
      motivation: (row.motivation as string | null) ?? null,
      stage: (row.stage as string | null) ?? null,
    };
  } catch (err) {
    logger.warn('getEconomicProfile failed', { err: String(err) }, 'EconomicProfile');
    return null;
  }
}

// getPublicEconomicProfile lives in ./economic-profile-public — the accessor
// safe for a viewer who isn't the profile's owner (kept there to stay under
// this file's line budget; see that file's header for why).

function dedupe<T>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const key = typeof it === 'string' ? it.toLowerCase().trim() : JSON.stringify(it);
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(it);
    }
  }
  return out;
}

/**
 * Merge-upsert: union the provided array dimensions onto what's stored (so an
 * interview round adds without clobbering), and overwrite scalars when provided.
 */
export async function saveEconomicProfile(
  supabase: AnySupabaseClient,
  userId: string,
  patch: Partial<EconomicProfile>
): Promise<boolean> {
  try {
    const current = (await getEconomicProfile(supabase, userId)) ?? EMPTY;
    const merged = {
      user_id: userId,
      skills: dedupe([...current.skills, ...(patch.skills ?? [])]),
      assets: dedupe([...current.assets, ...(patch.assets ?? [])]),
      goals: dedupe([...current.goals, ...(patch.goals ?? [])]),
      constraints: dedupe([...current.constraints, ...(patch.constraints ?? [])]),
      asked_for: dedupe([...current.askedFor, ...(patch.askedFor ?? [])]),
      not_available_for: dedupe([...current.notAvailableFor, ...(patch.notAvailableFor ?? [])]),
      motivation: patch.motivation !== undefined ? patch.motivation : current.motivation,
      stage: patch.stage !== undefined ? patch.stage : current.stage,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from(DATABASE_TABLES.USER_ECONOMIC_PROFILE)
      .upsert(merged, { onConflict: 'user_id' });
    if (error) {
      logger.warn('saveEconomicProfile upsert failed', { error }, 'EconomicProfile');
      return false;
    }
    return true;
  } catch (err) {
    logger.warn('saveEconomicProfile failed', { err: String(err) }, 'EconomicProfile');
    return false;
  }
}

/** What a profile removal actually did — reported verbatim, never guessed. */
export interface ProfileRemovalResult {
  /** Human-readable entries that were removed (e.g. "skill: photography"). */
  removed: string[];
  /** Terms that matched nothing in the profile. */
  notFound: string[];
  /**
   * Terms we could not answer for, because the write did not land.
   *
   * Same distinction as ForgetResult.failed: "your profile has no such entry"
   * and "we could not save the removal" used to be one value, so a failed
   * upsert reported notFound and the entry stayed in the profile while the user
   * was told it was gone. bitbaum/orangecat#563 finding 8.
   */
  failed: string[];
}

function entryText(it: unknown): string {
  if (typeof it === 'string') {
    return it;
  }
  const o = it as { name?: string; text?: string };
  return o?.name ?? o?.text ?? JSON.stringify(it);
}

function termMatches(term: string, text: string): boolean {
  const t = term.toLowerCase();
  const c = text.toLowerCase();
  if (c.includes(t) || t.includes(c)) {
    return true;
  }
  const sig = t.split(/[^a-z0-9äöüéèàç]+/).filter(w => w.length >= 4);
  const hits = sig.filter(w => c.includes(w)).length;
  return sig.length > 0 && (sig.length === 1 ? hits === 1 : hits >= 2);
}

/**
 * Remove profile entries matching the given terms across every array
 * dimension (skills, assets, goals, constraints, askedFor). Overwrites the
 * row directly — saveEconomicProfile() merge-unions, which can never shrink.
 * Same matching rules as memory forgetting so "photography doesn't apply"
 * clears both stores identically.
 */
export async function removeFromEconomicProfile(
  supabase: AnySupabaseClient,
  userId: string,
  terms: string[]
): Promise<ProfileRemovalResult> {
  // Same selector as the memory store. These used to disagree — this one had no
  // cap — so a 12-fact request cleared 12 profile entries and 10 memories, and
  // said nothing about the difference.
  const { wanted } = selectForgetFacts(terms);
  const result: ProfileRemovalResult = { removed: [], notFound: [], failed: [] };
  if (wanted.length === 0) {
    return result;
  }
  const current = await getEconomicProfile(supabase, userId);
  if (!current) {
    result.notFound.push(...wanted);
    return result;
  }

  const matchedTerms = new Set<string>();
  const dims: Array<{
    label: string;
    key: 'skills' | 'assets' | 'goals' | 'constraints' | 'askedFor' | 'notAvailableFor';
  }> = [
    { label: 'skill', key: 'skills' },
    { label: 'asset', key: 'assets' },
    { label: 'goal', key: 'goals' },
    { label: 'constraint', key: 'constraints' },
    { label: 'asked-for', key: 'askedFor' },
    { label: 'not-available-for', key: 'notAvailableFor' },
  ];
  const next: Record<string, unknown[]> = {};
  for (const dim of dims) {
    const kept: unknown[] = [];
    for (const item of current[dim.key] as unknown[]) {
      const text = entryText(item);
      const hit = wanted.find(t => termMatches(t, text));
      if (hit) {
        matchedTerms.add(hit);
        result.removed.push(`${dim.label}: ${text}`);
      } else {
        kept.push(item);
      }
    }
    next[dim.key] = kept;
  }
  result.notFound = wanted.filter(t => !matchedTerms.has(t));

  if (result.removed.length === 0) {
    return result;
  }
  try {
    const { error } = await supabase.from(DATABASE_TABLES.USER_ECONOMIC_PROFILE).upsert(
      {
        user_id: userId,
        skills: next.skills,
        assets: next.assets,
        goals: next.goals,
        constraints: next.constraints,
        asked_for: next.askedFor,
        not_available_for: next.notAvailableFor,
        motivation: current.motivation,
        stage: current.stage,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (error) {
      // The entries matched; saving the profile without them is what failed, so
      // they are still there. Reporting notFound would invert the truth.
      logger.warn('removeFromEconomicProfile upsert failed', { error }, 'EconomicProfile');
      return { removed: [], notFound: result.notFound, failed: [...matchedTerms] };
    }
  } catch (err) {
    logger.warn('removeFromEconomicProfile failed', { err: String(err) }, 'EconomicProfile');
    return { removed: [], notFound: result.notFound, failed: [...matchedTerms] };
  }
  return result;
}

/**
 * Normalize a loose object (LLM extraction or action params) into an EconomicProfile
 * patch: arrays accept plain strings or objects; scalars pass through when strings.
 * Returns null if nothing usable is present.
 */
export function normalizeEconomicPatch(
  o: Record<string, unknown>
): Partial<EconomicProfile> | null {
  const strs = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : [];
  const skills: EconomicSkill[] = (Array.isArray(o.skills) ? o.skills : [])
    .map(s => (typeof s === 'string' ? { name: s } : (s as EconomicSkill)))
    .filter(
      (s): s is EconomicSkill => !!s && typeof s.name === 'string' && s.name.trim().length > 0
    );
  const assets: EconomicAsset[] = (Array.isArray(o.assets) ? o.assets : [])
    .map(a => (typeof a === 'string' ? { name: a } : (a as EconomicAsset)))
    .filter(
      (a): a is EconomicAsset => !!a && typeof a.name === 'string' && a.name.trim().length > 0
    );
  const goals: EconomicGoal[] = (Array.isArray(o.goals) ? o.goals : [])
    .map(g => (typeof g === 'string' ? { text: g } : (g as EconomicGoal)))
    .filter(
      (g): g is EconomicGoal => !!g && typeof g.text === 'string' && g.text.trim().length > 0
    );

  const patch: Partial<EconomicProfile> = {
    skills,
    assets,
    goals,
    constraints: strs(o.constraints),
    askedFor: strs(o.asked_for ?? o.askedFor),
    notAvailableFor: strs(o.not_available_for ?? o.notAvailableFor),
    motivation: typeof o.motivation === 'string' && o.motivation.trim() ? o.motivation : undefined,
    stage: typeof o.stage === 'string' && o.stage.trim() ? o.stage : undefined,
  };
  const hasAny =
    skills.length > 0 ||
    assets.length > 0 ||
    goals.length > 0 ||
    (patch.constraints?.length ?? 0) > 0 ||
    (patch.askedFor?.length ?? 0) > 0 ||
    (patch.notAvailableFor?.length ?? 0) > 0 ||
    !!patch.motivation ||
    !!patch.stage;
  return hasAny ? patch : null;
}


/**
 * Passive, deterministic economic extraction — runs after each self-disclosing turn
 * (the reliable path the chat model's save_economic_profile action can't guarantee).
 * One extraction call → merge-upsert into the store. Fire-and-forget; never throws.
 */
export async function extractAndStoreEconomicProfile(
  supabase: AnySupabaseClient,
  userId: string,
  userMessage: string,
  assistantMessage: string,
  aiService: MemoryAiService,
  model: string
): Promise<void> {
  if (!looksLikeSelfDisclosure(userMessage)) {
    return;
  }
  try {
    const { content } = await aiService.chatCompletion({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: ECON_EXTRACTION_SYSTEM },
        {
          role: 'user',
          content: `User said: "${userMessage}"\n\nAssistant replied: "${assistantMessage.slice(0, 800)}"\n\nExtract the user's economic profile as a JSON object.`,
        },
      ],
    });
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start === -1 || end <= start) {
      return;
    }
    const parsed = JSON.parse(content.slice(start, end + 1)) as Record<string, unknown>;
    const patch = normalizeEconomicPatch(parsed);
    if (!patch) {
      return;
    }
    await saveEconomicProfile(supabase, userId, patch);
  } catch (err) {
    logger.warn('extractAndStoreEconomicProfile threw', { err: String(err) }, 'EconomicProfile');
  }
}
